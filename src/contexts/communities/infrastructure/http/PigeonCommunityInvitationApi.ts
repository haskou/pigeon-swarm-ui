import {
  CommunityInvitationConsent,
  CommunityInvitationKey,
  type CommunityInvitationFields,
  PrivateKey,
} from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityInvitationInput } from './CommunityInvitationInput';
import type { CommunityOperationBody } from './CommunityOperationBody';
import type { PigeonCommunitiesApi } from './PigeonCommunitiesApi';
import type { CommunityInvitationClaimResource } from './resources/CommunityInvitationClaimResource';
import type { CommunityInvitationPreviewResource } from './resources/CommunityInvitationPreviewResource';
import type { CommunityInvitationResource } from './resources/CommunityInvitationResource';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { pagedPath } from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';
import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import { CommunityModerationLogSigner } from './CommunityModerationLogSigner';
import { CommunityOperationSigner } from './CommunityOperationSigner';

/**
 * The signed invitations of a community: an issuer creates and revokes them,
 * a link holder previews and claims one, and a member who manages members
 * admits the claimants. The link secret stays on the device that holds it:
 * the node only ever sees the invitation's public key.
 */
export class PigeonCommunityInvitationApi {
  private readonly moderationLogs: CommunityModerationLogSigner;

  private readonly notifications: NotificationMutationSigner;

  private readonly operations: CommunityOperationSigner;

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly communities: Pick<PigeonCommunitiesApi, 'head'>,
    private readonly mutations: PublicMutationSigner,
    private readonly frontiers = new ScopeFrontierReader(http, signer),
  ) {
    this.moderationLogs = new CommunityModerationLogSigner(
      mutations,
      frontiers,
    );
    this.notifications = new NotificationMutationSigner(mutations);
    this.operations = new CommunityOperationSigner(mutations);
  }

  private basePath(communityId: string): string {
    return `/communities/${encodeURIComponent(communityId)}`;
  }

  private async signedRequest<T>(
    session: Session,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    return await this.http.request<T>(path, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: await this.signer.headers(session, method, path, body),
      method,
    });
  }

  /** Every page of a cursor-paged list, each request signed per path. */
  private async readPagedList<Page extends { nextCursor: string | null }>(
    session: Session,
    path: string,
  ): Promise<Page[]> {
    return await readAllPages<Page>(async (cursor) => {
      const target = pagedPath(path, cursor);

      return await this.http.request<Page>(target, {
        headers: await this.signer.headers(session, 'GET', target),
        method: 'GET',
      });
    });
  }

  private async signOperation(
    session: Session,
    communityId: string,
    action: string,
    args: Record<string, unknown>,
    createdAt: number,
  ): Promise<CommunityOperationBody> {
    const { frontier, networkId } = await this.communities.head(
      session,
      communityId,
    );

    return await this.operations.sign(session, {
      action,
      args,
      communityId,
      createdAt,
      networkId,
      parents: frontier,
    });
  }

  public async create(
    session: Session,
    communityId: string,
    input: CommunityInvitationInput,
  ): Promise<CommunityInvitationResource> {
    const createdAt = Date.now();
    const operation = await this.signOperation(
      session,
      communityId,
      'invitation_created',
      Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
      createdAt,
    );
    const body = {
      ...input,
      moderationLog: await this.moderationLogs.sign(session, {
        action: 'invitation_created',
        communityId,
        createdAt,
        details: { expiresAt: input.expiresAt, maxUses: input.maxUses },
        // The invitation is named by the digest of the operation that creates
        // it: the hash its record id `community:<id>:op:<hash>` ends with.
        target: {
          id: operation.mutation.recordId.split(':op:')[1] as string,
          type: 'invitation',
        },
      }),
      operation,
    };

    return await this.signedRequest<CommunityInvitationResource>(
      session,
      'POST',
      `${this.basePath(communityId)}/invitations`,
      body,
    );
  }

  public async list(
    session: Session,
    communityId: string,
  ): Promise<CommunityInvitationResource[]> {
    const pages = await this.readPagedList<{
      invitations: CommunityInvitationResource[];
      nextCursor: string | null;
    }>(session, `${this.basePath(communityId)}/invitations`);

    return pages.flatMap((page) => page.invitations);
  }

  /** What the link names; the node answers only to the invitation's key. */
  public async preview(
    communityId: string,
    invitationKey: string,
  ): Promise<CommunityInvitationPreviewResource> {
    return await this.http.request<CommunityInvitationPreviewResource>(
      `${this.basePath(communityId)}/invitation-preview`,
      { headers: { Authorization: `Bearer ${invitationKey}` }, method: 'GET' },
    );
  }

  /**
   * Claims an invitation: the possession proof shows the claimant holds the
   * link, the consent that the claimant itself asks to join.
   */
  public async claim(
    session: Session,
    preview: CommunityInvitationPreviewResource,
    secret: string,
  ): Promise<void> {
    const { communityId, invitationId, networkId } = preview;
    const identityId = this.mutations.authorOf(session);
    const fields: CommunityInvitationFields = {
      communityId,
      identityId,
      invitationId,
      networkId,
    };
    const proofs = {
      consent: CommunityInvitationConsent.sign(
        fields,
        new PrivateKey(session.keyPair.toPrimitives().privateKey),
      ),
      possession:
        CommunityInvitationKey.fromSecret(secret).signPossession(fields),
    };
    const record = {
      communityId,
      ...proofs,
      id: `invitation-claim:${invitationId}:${identityId}`,
      identityId,
      invitationId,
      scopeType: 'community_invitation_claim',
    };
    const path = `${this.basePath(communityId)}/invitations/${encodeURIComponent(
      invitationId,
    )}/claims`;
    const frontier = await this.frontiers.community(session, communityId);

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            frontier,
            kind: 'put',
            payload: record,
            recordId: record.id,
            store: 'requests',
          },
          position,
        ),
      async (mutation) => {
        await this.signedRequest(session, 'POST', path, {
          ...proofs,
          mutation,
        });
      },
    );
  }

  public async listClaims(
    session: Session,
    communityId: string,
  ): Promise<CommunityInvitationClaimResource[]> {
    const pages = await this.readPagedList<{
      claims: CommunityInvitationClaimResource[];
      nextCursor: string | null;
    }>(session, `${this.basePath(communityId)}/invitation-claims`);

    return pages.flatMap((page) => page.claims);
  }

  /** Admits a claimant: a signed `member_joined` that carries its proofs. */
  public async admit(
    session: Session,
    claim: CommunityInvitationClaimResource,
  ): Promise<void> {
    const { communityId, consent, identityId, invitationId, possession } =
      claim;
    const operation = await this.signOperation(
      session,
      communityId,
      'member_joined',
      { consent, identityId, invitationId, method: 'invitation', possession },
      Date.now(),
    );

    await this.signedRequest(
      session,
      'POST',
      `${this.basePath(communityId)}/invitations/${encodeURIComponent(
        invitationId,
      )}/admissions`,
      { consent, identityId, operation, possession },
    );
  }

  public async revoke(
    session: Session,
    communityId: string,
    invitationId: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const body = {
      moderationLog: await this.moderationLogs.sign(session, {
        action: 'invitation_revoked',
        communityId,
        createdAt,
        details: {},
        target: { id: invitationId, type: 'invitation' },
      }),
      operation: await this.signOperation(
        session,
        communityId,
        'invitation_revoked',
        { invitationId },
        createdAt,
      ),
    };

    await this.signedRequest(
      session,
      'POST',
      `${this.basePath(communityId)}/invitations/${encodeURIComponent(
        invitationId,
      )}/revocation`,
      body,
    );
  }

  /** Tells an identity that its request to join the community was accepted. */
  public async notifyMember(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const invitation = await this.notifications.invitation(session, {
      recipientIdentityId,
      subjectId: communityId,
      type: 'community_invitation',
    });

    await this.signedRequest(session, 'POST', '/notifications', {
      communityId,
      inviterIdentityId: invitation.inviterIdentityId,
      mutation: invitation.mutation,
      nonce: invitation.nonce,
      recipientIdentityId: invitation.recipientIdentityId,
      type: 'community_invitation',
    });
  }
}
