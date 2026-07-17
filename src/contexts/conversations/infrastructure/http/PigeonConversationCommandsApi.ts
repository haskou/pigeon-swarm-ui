import { PublicKey, SymmetricKey } from '@haskou/value-objects';

import type {
  ConversationResource,
  ConversationKeyEntry,
  IdentityResource,
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import type { ConversationIdentityReader } from './ConversationIdentityReader';
import type { ConversationInvitationType } from './ConversationInvitationType';
import type { ConversationKeychainPublisher } from './ConversationKeychainPublisher';
import type { ConversationMapper } from './ConversationMapper';
import type { GroupConversationInput } from './GroupConversationInput';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { ConversationNetworkId } from '../../domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';

export class PigeonConversationCommandsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly conversations: ConversationMapper,
    private readonly ids: ConversationIdFactory,
    private readonly identities: ConversationIdentityReader,
    private readonly keychains: ConversationKeychainPublisher,
    private readonly requestCache: RequestCache,
  ) {}

  private async createInvitation(
    session: Session,
    peerIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
    invitationType: ConversationInvitationType = 'conversation_invitation',
  ): Promise<void> {
    const path = '/notifications/';
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedConversationKey = PublicKey.fromPEM(
      peerIdentity.encryptedKeyPair.publicKey,
    )
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
    const inviterSignature = await signSessionPayload(
      session,
      JSON.stringify({
        conversationId: keyEntry.conversationId,
        encryptedConversationKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: peerIdentity.id,
      }),
    );
    const body = {
      conversationId: keyEntry.conversationId,
      encryptedConversationKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: peerIdentity.id,
      type: invitationType,
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  private createConversationKeyEntry(
    identityId: string,
    peerIdentityId: string,
    networkId: string,
  ): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId: this.ids
        .create(
          ConversationParticipantId.fromString(identityId),
          ConversationParticipantId.fromString(peerIdentityId),
          ConversationNetworkId.fromString(networkId),
        )
        .toString(),
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'conversation',
      peerIdentityId,
      version: 2,
    };
  }

  private createGroupConversationKeyEntry(
    conversationId: string,
  ): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId,
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

  private withServerConversationId(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
    conversationId: string,
  ): LocalKeychain {
    if (conversationId === keyEntry.conversationId) return keychain;

    return {
      ...keychain,
      conversations: {
        ...keychain.conversations,
        [conversationId]: { ...keyEntry, conversationId },
      },
    };
  }

  private async postConversation(
    session: Session,
    peerIdentityId: string,
    published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    },
    networkId: string,
  ): Promise<ConversationResource> {
    const body = {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      networkId,
      participantIds: [session.identity.id, peerIdentityId].sort(),
      type: 'one-to-one',
    };
    const path = '/conversations';
    const created = await this.http.request<ConversationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        {
          ...session,
          keychain: published.keychain,
          keychainExternalIdentifier: published.keychainExternalIdentifier,
        },
        'POST',
        path,
        body,
      ),
      method: 'POST',
    });
    this.requestCache.invalidateForSession('/conversations/?limit=30', session);

    return this.conversations.normalize(created, peerIdentityId);
  }

  private async postGroupConversation(
    session: Session,
    input: {
      keychainExternalIdentifier: null | string;
      name: string;
      networkId: string;
      participantIds: string[];
    },
  ): Promise<ConversationResource> {
    const body = {
      keychainExternalIdentifier: input.keychainExternalIdentifier,
      name: input.name,
      networkId: input.networkId,
      participantIds: input.participantIds,
      type: 'group',
    };
    const path = '/conversations';
    const created = await this.http.request<ConversationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
    this.requestCache.invalidateForSession('/conversations/?limit=30', session);

    return this.conversations.normalize(created);
  }

  public async create(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const peerIdentity = await this.identities.get(peerIdentityId.trim());
    const keyEntry = this.createConversationKeyEntry(
      session.identity.id,
      peerIdentity.id,
      networkId,
    );
    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const conversation = await this.postConversation(
      session,
      peerIdentity.id,
      published,
      networkId,
    );
    const serverKeyEntry = { ...keyEntry, conversationId: conversation.id };

    await this.createInvitation(session, peerIdentity, serverKeyEntry);

    return {
      conversation,
      keychain: this.withServerConversationId(
        published.keychain,
        keyEntry,
        conversation.id,
      ),
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async createGroup(
    session: Session,
    input: GroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const participantIds = [session.identity.id, ...input.participantIds]
      .filter(Boolean)
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort();
    const conversation = await this.postGroupConversation(session, {
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      name: input.name.trim(),
      networkId: input.networkId,
      participantIds,
    });
    const keyEntry = this.createGroupConversationKeyEntry(conversation.id);
    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const invitedIdentities = await Promise.all(
      participantIds
        .filter((identityId) => identityId !== session.identity.id)
        .map((identityId) => this.identities.get(identityId)),
    );

    await Promise.all(
      invitedIdentities.map((identity) =>
        this.createInvitation(
          session,
          identity,
          keyEntry,
          'group_conversation_invitation',
        ),
      ),
    );

    return {
      conversation,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async invite(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
    invitationType: ConversationInvitationType = 'conversation_invitation',
  ): Promise<void> {
    const keyEntry = session.keychain.conversations[conversationId];

    if (!keyEntry) throw new Error('Conversation key is required.');

    const recipientIdentity = await this.identities.get(
      recipientIdentityId.trim(),
    );

    await this.createInvitation(
      session,
      recipientIdentity,
      keyEntry,
      invitationType,
    );
  }
}
