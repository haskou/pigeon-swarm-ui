import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type {
  Community,
  CommunityInviteLinkResource,
  ConversationKeyEntry,
  IdentityResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { PigeonIdentityGateway } from '../../../identities/infrastructure/http/PigeonIdentityGateway';
import type { PigeonKeychainApi } from '../../../identities/infrastructure/http/PigeonKeychainApi';
import type { EncryptedCommunityKey } from '../crypto/communityInviteKeyEnvelope';
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';
import type { PigeonCommunitiesApi } from './PigeonCommunitiesApi';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import { encryptCommunityInviteKey } from '../crypto/communityInviteKeyEnvelope';
import { buildCommunityInviteLinkBody } from './buildCommunityInviteLinkBody';
import { CommunityModerationLogSigner } from './CommunityModerationLogSigner';
import { CommunityOperationSigner } from './CommunityOperationSigner';
import { deriveInviteToken } from './deriveCommunityRecordId';

export class PigeonCommunityInvitationApi {
  private readonly notificationPath = '/notifications/';

  private readonly moderationLogs = new CommunityModerationLogSigner();

  private readonly mutations = new PublicMutationSigner();

  private readonly operations = new CommunityOperationSigner();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly communities: Pick<
      PigeonCommunitiesApi,
      'frontier' | 'get' | 'inviteMember'
    >,
    private readonly identities: Pick<PigeonIdentityGateway, 'get'>,
    private readonly keychains: Pick<PigeonKeychainApi, 'publishKeychain'>,
  ) {}

  private createKeyEntry(communityId: string): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId: communityId,
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'conversation',
      peerIdentityId: '',
      version: 2,
    };
  }

  private withConversationKey(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
  ): LocalKeychain {
    return {
      conversations: {
        ...keychain.conversations,
        [keyEntry.conversationId]: keyEntry,
      },
      version: keychain.version + 1,
    };
  }

  private async isPublicCommunityWithoutKey(
    session: Session,
    communityId: string,
    existingKeyEntry?: ConversationKeyEntry,
  ): Promise<boolean> {
    if (existingKeyEntry) return false;

    const community = await this.communities.get(session, communityId);

    return community.visibility === 'public';
  }

  private async publishCommunityKeyIfNeeded(
    session: Session,
    communityId: string,
    existingKeyEntry?: ConversationKeyEntry,
  ): Promise<{
    keyEntry: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const keyEntry = existingKeyEntry ?? this.createKeyEntry(communityId);

    if (existingKeyEntry && session.keychainExternalIdentifier) {
      return {
        keychain: session.keychain,
        keychainExternalIdentifier: session.keychainExternalIdentifier,
        keyEntry,
      };
    }

    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );

    return { keyEntry, ...published };
  }

  private async postInviteLink(
    session: Session,
    communityId: string,
    path: string,
    input: CommunityInviteLinkInput,
    encryptedCommunityKey?: EncryptedCommunityKey,
  ): Promise<CommunityInviteLinkResource> {
    const creatorIdentityId = this.mutations.authorOf(session);
    const nonce = this.createNonce();
    const createdAt = Date.now();
    const token = deriveInviteToken(communityId, creatorIdentityId, nonce);
    const optional = buildCommunityInviteLinkBody(input, encryptedCommunityKey);
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
      ...(optional.encryptedCommunityKey
        ? { encryptedCommunityKey: optional.encryptedCommunityKey }
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
          moderationLog: this.moderationLogs.sign(session, {
            action: 'invite_link_created',
            communityId,
            createdAt,
            details: {
              encryptedCommunityKeyStored: Boolean(
                optional.encryptedCommunityKey,
              ),
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
    keyEntry: ConversationKeyEntry,
    recipientIdentityId: string,
  ): Promise<void> {
    const recipientIdentity = await this.identities.get(recipientIdentityId);
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedCommunityKey = this.encryptCommunityKey(
      recipientIdentity,
      recipientKeyEntry,
    );

    const invitation = new NotificationMutationSigner().invitation(session, {
      encryptedKey: encryptedCommunityKey,
      recipientIdentityId: recipientIdentity.id,
      subjectId: keyEntry.conversationId,
      type: 'community_invitation',
    });
    const body = {
      communityId: keyEntry.conversationId,
      encryptedCommunityKey,
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

  private encryptCommunityKey(
    recipientIdentity: IdentityResource,
    recipientKeyEntry: ConversationKeyEntry & { peerIdentityId: string },
  ): string {
    return IdentityId.fromString(recipientIdentity.id)
      .getPublicKey()
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
  }

  public async create(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    const normalizedRecipientIdentityId = recipientIdentityId.trim();
    const existingKeyEntry = session.keychain.conversations[communityId];

    if (
      await this.isPublicCommunityWithoutKey(
        session,
        communityId,
        existingKeyEntry,
      )
    ) {
      await this.communities.inviteMember(
        session,
        communityId,
        normalizedRecipientIdentityId,
      );

      return {
        keychain: session.keychain,
        keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      };
    }

    const published = await this.publishCommunityKeyIfNeeded(
      session,
      communityId,
      existingKeyEntry,
    );
    const invitationSession = {
      ...session,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };

    await this.communities.inviteMember(
      invitationSession,
      communityId,
      normalizedRecipientIdentityId,
    );
    await this.sendCommunityInvitation(
      invitationSession,
      published.keyEntry,
      normalizedRecipientIdentityId,
    );

    return {
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async notifyMember(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const keyEntry = session.keychain.conversations[communityId];

    if (!keyEntry) throw new Error('Community key is required.');

    await this.sendCommunityInvitation(session, keyEntry, recipientIdentityId);
  }

  public async createInviteLink(
    session: Session,
    communityId: string,
    input: CommunityInviteLinkInput = {},
  ): Promise<{
    invite: CommunityInviteLinkResource;
    inviteSecret?: string;
    keyEntry?: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: null | string;
  }> {
    const path = `/communities/${encodeURIComponent(communityId)}/invites`;
    const existingKeyEntry = session.keychain.conversations[communityId];

    if (
      await this.isPublicCommunityWithoutKey(
        session,
        communityId,
        existingKeyEntry,
      )
    ) {
      const invite = await this.postInviteLink(
        session,
        communityId,
        path,
        input,
      );

      return {
        invite,
        keychain: session.keychain,
        keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      };
    }

    const published = await this.publishCommunityKeyIfNeeded(
      session,
      communityId,
      existingKeyEntry,
    );
    const encryptedKey = await encryptCommunityInviteKey(published.keyEntry);
    const invite = await this.postInviteLink(
      session,
      communityId,
      path,
      input,
      encryptedKey.encryptedCommunityKey,
    );

    return {
      invite,
      inviteSecret: encryptedKey.secret,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      keyEntry: published.keyEntry,
    };
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
    const operation = this.operations.sign(session, {
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

  public async acceptInviteLinkWithKey(
    session: Session,
    inviteToken: string,
    keyEntry: ConversationKeyEntry,
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const community = await this.acceptInviteLink(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      inviteToken,
    );

    return {
      community,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }
}
