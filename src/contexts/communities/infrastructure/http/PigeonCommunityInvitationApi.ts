import { PublicKey, SymmetricKey } from '@haskou/value-objects';

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
import type { CommunityInviteLinkInput } from './CommunityInviteLinkInput';
import type { PigeonCommunitiesApi } from './PigeonCommunitiesApi';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { encryptCommunityInviteKey } from '../crypto/communityInviteKeyEnvelope';
import { buildCommunityInviteLinkBody } from './buildCommunityInviteLinkBody';

export class PigeonCommunityInvitationApi {
  private readonly notificationPath = '/notifications/';

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly communities: Pick<
      PigeonCommunitiesApi,
      'get' | 'inviteMember'
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
    path: string,
    body: ReturnType<typeof buildCommunityInviteLinkBody>,
  ): Promise<CommunityInviteLinkResource> {
    return await this.http.request<CommunityInviteLinkResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
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

    const inviterSignature = await signSessionPayload(
      session,
      JSON.stringify({
        communityId: keyEntry.conversationId,
        encryptedCommunityKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: recipientIdentity.id,
      }),
    );
    const body = {
      communityId: keyEntry.conversationId,
      encryptedCommunityKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: recipientIdentity.id,
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
    return PublicKey.fromPEM(recipientIdentity.encryptedKeyPair.publicKey)
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
        path,
        buildCommunityInviteLinkBody(input),
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
      path,
      buildCommunityInviteLinkBody(input, encryptedKey.encryptedCommunityKey),
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
    const body = {};

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
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
