import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';
import type { ConversationKeyEntry } from '../../../identities/infrastructure/keychain/ConversationKeyEntry';
import type { LocalKeychain } from '../../../identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import type { ConversationIdentityReader } from './ConversationIdentityReader';
import type { ConversationKeychainPublisher } from './ConversationKeychainPublisher';
import type { ConversationMapper } from './ConversationMapper';
import type { ConversationOperationSigner } from './ConversationOperationSigner';
import type { ConversationResource } from './ConversationResource';
import type { PigeonConversationCommandsApiDependencies } from './PigeonConversationCommandsApiDependencies';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import { ConversationNetworkId } from '../../domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';

export class PigeonConversationCommandsApi {
  private readonly invitations: NotificationMutationSigner;

  private readonly http: HttpJsonClient;
  private readonly signer: RequestSigner;
  private readonly conversations: ConversationMapper;
  private readonly ids: ConversationIdFactory;
  private readonly identities: ConversationIdentityReader;
  private readonly keychains: ConversationKeychainPublisher;
  private readonly requestCache: RequestCache;
  private readonly operations: ConversationOperationSigner;

  public constructor(dependencies: PigeonConversationCommandsApiDependencies) {
    this.http = dependencies.http;
    this.signer = dependencies.signer;
    this.conversations = dependencies.conversations;
    this.ids = dependencies.ids;
    this.identities = dependencies.identities;
    this.keychains = dependencies.keychains;
    this.requestCache = dependencies.requestCache;
    this.operations = dependencies.operations;
    this.invitations = new NotificationMutationSigner(dependencies.mutations);
  }

  private async createInvitation(
    session: Session,
    peerIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
  ): Promise<void> {
    const path = '/notifications/';
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedConversationKey = IdentityId.fromString(peerIdentity.id)
      .getPublicKey()
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
    const invitation = await this.invitations.invitation(session, {
      encryptedKey: encryptedConversationKey,
      recipientIdentityId: peerIdentity.id,
      subjectId: keyEntry.conversationId,
      type: 'conversation_invitation',
    });
    const body = {
      conversationId: keyEntry.conversationId,
      encryptedConversationKey,
      inviterIdentityId: invitation.inviterIdentityId,
      mutation: invitation.mutation,
      nonce: invitation.nonce,
      recipientIdentityId: invitation.recipientIdentityId,
      type: 'conversation_invitation',
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
    published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    },
    body: Record<string, unknown>,
  ): Promise<ConversationResource> {
    const path = '/conversations';
    const created = await this.http.request<unknown>(path, {
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

    return this.conversations.resource(created);
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
    const published = await this.keychains.publishKeychain(session, (current) =>
      this.withConversationKey(current, keyEntry),
    );
    const conversation = await this.postConversation(session, published, {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      networkId,
      operation: await this.operations.sign(session, {
        action: 'conversation_created',
        args: {
          participantIds: [session.identity.id, peerIdentity.id].sort(),
          type: 'one-to-one',
        },
        conversationId: keyEntry.conversationId,
        createdAt: Date.now(),
        networkId,
        parents: [],
      }),
      participantIds: [session.identity.id, peerIdentity.id].sort(),
      type: 'one-to-one',
    });
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
}
