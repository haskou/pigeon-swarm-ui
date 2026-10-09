import { Buffer } from 'buffer';

import type {
  Community,
  CommunityInviteLinkResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';
import type { PigeonCommunitiesApi } from './PigeonCommunitiesApi';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import { buildCommunityInviteLinkBody } from './buildCommunityInviteLinkBody';
import { CommunityModerationLogSigner } from './CommunityModerationLogSigner';
import { CommunityOperationSigner } from './CommunityOperationSigner';
import { deriveInviteToken } from './deriveCommunityRecordId';

export class PigeonCommunityInvitationApi {
  private readonly notificationPath = '/notifications/';

  private readonly moderationLogs: CommunityModerationLogSigner;

  private readonly notifications: NotificationMutationSigner;

  private readonly operations: CommunityOperationSigner;

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly communities: Pick<
      PigeonCommunitiesApi,
      'frontier' | 'get' | 'inviteMember'
    >,
    private readonly mutations: PublicMutationSigner,
  ) {
    this.moderationLogs = new CommunityModerationLogSigner(mutations);
    this.notifications = new NotificationMutationSigner(mutations);
    this.operations = new CommunityOperationSigner(mutations);
  }

  private async postInviteLink(
    session: Session,
    communityId: string,
    path: string,
    input: CommunityInviteLinkInput,
  ): Promise<CommunityInviteLinkResource> {
    const creatorIdentityId = this.mutations.authorOf(session);
    const nonce = this.createNonce();
    const createdAt = Date.now();
    const token = deriveInviteToken(communityId, creatorIdentityId, nonce);
    const optional = buildCommunityInviteLinkBody(input);
    const record = {
      communityId,
      createdAt,
      creatorIdentityId,
      id: token,
      maxUses: input.maxUses ?? 1,
      nonce,
      scopeType: 'community_invite',
      token,
      ...(optional.expiresAt !== undefined
        ? { expiresAt: optional.expiresAt }
        : {}),
    };
    let response: CommunityInviteLinkResource | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          { kind: 'put', payload: record, recordId: token, store: 'requests' },
          position,
        ),
      async (mutation) => {
        const body = {
          createdAt,
          moderationLog: await this.moderationLogs.sign(session, {
            action: 'invite_link_created',
            communityId,
            createdAt,
            details: {
              expiresAt: optional.expiresAt || undefined,
              maxUses: input.maxUses || undefined,
            },
            target: { id: token, type: 'invite' },
          }),
          mutation,
          nonce,
          ...optional,
          ...(input.maxUses === undefined ? {} : { maxUses: input.maxUses }),
        };

        response = await this.http.request<CommunityInviteLinkResource>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, 'POST', path, body),
          method: 'POST',
        });
      },
    );

    return response as CommunityInviteLinkResource;
  }

  private createNonce(): string {
    const bytes = new Uint8Array(24);

    crypto.getRandomValues(bytes);

    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async sendCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const invitation = await this.notifications.invitation(session, {
      recipientIdentityId,
      subjectId: communityId,
      type: 'community_invitation',
    });
    const body = {
      communityId,
      inviterIdentityId: invitation.inviterIdentityId,
      mutation: invitation.mutation,
      nonce: invitation.nonce,
      recipientIdentityId: invitation.recipientIdentityId,
      type: 'community_invitation',
    };

    await this.http.request(this.notificationPath, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        session,
        'POST',
        this.notificationPath,
        body,
      ),
      method: 'POST',
    });
  }

  private async isPublic(session: Session, communityId: string) {
    return (
      (await this.communities.get(session, communityId)).visibility === 'public'
    );
  }

  public async create(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const recipient = recipientIdentityId.trim();

    await this.communities.inviteMember(session, communityId, recipient);

    if (await this.isPublic(session, communityId)) return;

    await this.sendCommunityInvitation(session, communityId, recipient);
  }

  public async notifyMember(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    await this.sendCommunityInvitation(
      session,
      communityId,
      recipientIdentityId,
    );
  }

  public async createInviteLink(
    session: Session,
    communityId: string,
    input: CommunityInviteLinkInput = {},
  ): Promise<CommunityInviteLinkResource> {
    const path = `/communities/${encodeURIComponent(communityId)}/invites`;

    return await this.postInviteLink(session, communityId, path, input);
  }

  public async getInviteLink(
    inviteToken: string,
  ): Promise<CommunityInviteLinkResource> {
    return await this.http.request<CommunityInviteLinkResource>(
      `/communities/invites/${encodeURIComponent(inviteToken)}`,
    );
  }

  public async acceptInviteLink(
    session: Session,
    inviteToken: string,
  ): Promise<Community> {
    const path = `/communities/invites/${encodeURIComponent(
      inviteToken,
    )}/accept`;
    const invite = await this.getInviteLink(inviteToken);
    const token = invite.token ?? invite.inviteToken ?? inviteToken;
    const identityId = this.mutations.authorOf(session);
    const usedAt = Date.now();
    const communityId = invite.communityId as string;
    const networkId = invite.networkId as string;
    const operation = await this.operations.sign(session, {
      action: 'member_joined',
      args: { identityId, method: 'invite_link', reference: token },
      communityId,
      createdAt: usedAt,
      networkId,
      parents: await this.communities.frontier(session, communityId),
    });
    const record = {
      communityId: invite.communityId,
      id: `invite-use:${token}:${identityId}`,
      identityId,
      scopeType: 'community_invite_use',
      token,
      usedAt,
    };
    let community: Community | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            kind: 'put',
            payload: record,
            recordId: record.id,
            store: 'requests',
          },
          position,
        ),
      async (mutation) => {
        const body = { mutation, operation, usedAt };

        community = await this.http.request<Community>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, 'POST', path, body),
          method: 'POST',
        });
      },
    );

    return community as Community;
  }
}
