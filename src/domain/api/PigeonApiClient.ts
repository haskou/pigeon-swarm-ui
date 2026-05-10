import {
  EncryptedKeyPair,
  EncryptedPrivateKey,
  KeyPair,
  PrivateKey,
  PublicKey,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';

import type {
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  MessageResource,
  Session,
} from '../types';

import { API_SERVER_URL } from '../../config';
import { ApiUrlBuilder } from './ApiUrlBuilder';
import { ConversationIdFactory } from './ConversationIdFactory';
import { ConversationProjector } from './ConversationProjector';
import { HttpJsonClient } from './HttpJsonClient';
import { KeychainCipher } from './KeychainCipher';
import { MessageProjector } from './MessageProjector';
import { RequestSigner } from './RequestSigner';

const defaultKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonApiClient {
  private readonly conversations: ConversationProjector;

  private readonly http: HttpJsonClient;

  private readonly ids: ConversationIdFactory;

  private readonly keychains: KeychainCipher;

  private readonly messages: MessageProjector;

  private readonly signer: RequestSigner;

  public constructor(
    http: HttpJsonClient = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
    signer: RequestSigner = new RequestSigner(),
    conversations: ConversationProjector = new ConversationProjector(),
    messages: MessageProjector = new MessageProjector(),
    keychains: KeychainCipher = new KeychainCipher(),
    ids: ConversationIdFactory = new ConversationIdFactory(),
  ) {
    this.conversations = conversations;
    this.http = http;
    this.ids = ids;
    this.keychains = keychains;
    this.messages = messages;
    this.signer = signer;
  }

  public apiUrl(path: string): string {
    return new ApiUrlBuilder(API_SERVER_URL).build(path);
  }

  public async getNodeInfo(): Promise<{ id: string; owner: string | null }> {
    return await this.http.request<{ id: string; owner: string | null }>(
      '/node/',
    );
  }

  public async getNodeNetworks(): Promise<{ id: string; name: string }[]> {
    const result = await this.http.request<{
      networks: { id: string; name: string }[];
    }>('/node/networks/');

    return result.networks;
  }

  public async createConversation(
    session: Session,
    peerIdentityId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const peerIdentity = await this.getIdentity(peerIdentityId.trim());
    const keyEntry = await this.createConversationKeyEntry(
      session.identity.id,
      peerIdentity.id,
    );
    const published = await this.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const conversation = await this.postConversation(
      session,
      peerIdentity.id,
      published,
    );

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

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
  ): Promise<IdentityResource> {
    return await this.http.request<IdentityResource>('/identities/', {
      body: JSON.stringify({
        name,
        networks: networks.filter(Boolean),
        password,
      }),
      method: 'POST',
    });
  }

  public async decryptKeychain(
    session: Session,
    keychain: KeychainResource,
  ): Promise<LocalKeychain> {
    return await this.keychains.decrypt(session, keychain);
  }

  public async decryptMessage(
    session: Session,
    conversationId: string,
    message: MessageResource,
  ): Promise<ChatMessage> {
    return await this.messages.toChatMessage(session, conversationId, message);
  }

  public deterministicConversationId(
    leftIdentityId: string,
    rightIdentityId: string,
  ): string {
    return this.ids.create(leftIdentityId, rightIdentityId);
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.http.request<IdentityResource>(
      `/identities/${encodeURIComponent(identityId)}`,
    );
  }

  public async createNetwork(name: string): Promise<void> {
    await this.http.request('/node/networks/', {
      body: JSON.stringify({
        id: UUID.generate().toString(),
        key: PrivateKey.generate().toString(),
        name,
      }),
      method: 'POST',
    });
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
  ): Promise<void> {
    await this.http.request('/node/networks/', {
      body: JSON.stringify({ id, key, name }),
      method: 'POST',
    });
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    const path = '/conversations?limit=30';
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return this.conversations.list(raw);
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    const path = this.messagesPath(conversationId, before);
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
    const normalized = this.messages.list(raw);

    return {
      messages: await Promise.all(
        normalized.messages.map((message) =>
          this.decryptMessage(session, conversationId, message),
        ),
      ),
      nextCursor: normalized.nextCursor,
    };
  }

  public async loadRemoteKeychain(session: Session): Promise<KeychainResource> {
    const path = `/keychains/${encodeURIComponent(session.identity.id)}`;

    return await this.http.request<KeychainResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async login(
    identityId: string,
    password: string,
  ): Promise<LoginResult> {
    const identity = await this.getIdentity(identityId.trim());
    const encryptedKeyPair = this.restoreEncryptedKeyPair(identity);

    await encryptedKeyPair.sign(
      new StringValueObject(`pigeon-swarm:login:${identity.id}`),
      new StringValueObject(password),
    );

    const session: Session = {
      encryptedKeyPair,
      identity,
      keychain: defaultKeychain,
      password,
    };
    const keychainResource = await this.loadRemoteKeychain(session).catch(
      () => undefined,
    );
    const keychain = keychainResource
      ? await this.decryptKeychain(session, keychainResource)
      : defaultKeychain;
    const hydratedSession = {
      ...session,
      keychain,
      keychainExternalIdentifier:
        keychainResource?.keychainExternalIdentifier ?? null,
    };
    const conversations = await this.listConversations(hydratedSession).catch(
      () => [],
    );

    return { conversations, session: hydratedSession };
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    const path = '/keychains/';
    const encrypted = await this.keychains.encryptForPublish(
      session,
      nextKeychain,
    );
    const published = await this.http.request<{
      keychainExternalIdentifier: string;
      ownerIdentityId: string;
      version: number;
    }>(path, {
      body: JSON.stringify(encrypted.body),
      headers: await this.signer.headers(session, 'POST', path, encrypted.body),
      method: 'POST',
    });

    return {
      keychain: encrypted.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
  ): Promise<LoginResult> {
    const identity = await this.createIdentity(name, password, networks);

    return await this.login(identity.id, password);
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
  ): Promise<ChatMessage> {
    const key = session.keychain.conversations[conversationId];

    if (!key) {
      throw new Error(
        'No hay clave privada de conversación en el keychain. Drama criptográfico, el peor tipo de drama.',
      );
    }

    const timestamp = Date.now();
    const encryptedPayload = PublicKey.fromPEM(key.publicKey)
      .encrypt(
        new StringValueObject(
          JSON.stringify({
            authorIdentityId: session.identity.id,
            content,
            conversationId,
            timestamp,
            type: 'MessageSent',
          }),
        ),
      )
      .toString();
    const signature = await session.encryptedKeyPair.sign(
      new StringValueObject(encryptedPayload),
      new StringValueObject(session.password),
    );
    const body = {
      attachmentExternalIdentifiers: [],
      createdAt: timestamp,
      encryptedPayload,
      id: `${conversationId}:${timestamp}:${crypto.randomUUID()}`,
      signature: signature.toString(),
    };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages`;
    const created = await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    return await this.decryptMessage(session, conversationId, created);
  }

  private async createConversationKeyEntry(
    identityId: string,
    peerIdentityId: string,
  ): Promise<ConversationKeyEntry> {
    const conversationKeyPair = await KeyPair.generate();
    const keyPairPrimitives = conversationKeyPair.toPrimitives();
    const conversationId = this.deterministicConversationId(
      identityId,
      peerIdentityId,
    );

    return {
      conversationId,
      createdAt: Date.now(),
      peerIdentityId,
      privateKey: keyPairPrimitives.privateKey,
      publicKey: keyPairPrimitives.publicKey,
    };
  }

  private restoreEncryptedKeyPair(
    identity: IdentityResource,
  ): EncryptedKeyPair {
    return new EncryptedKeyPair(
      PublicKey.fromPEM(
        new StringValueObject(identity.encryptedKeyPair.publicKey),
      ),
      new EncryptedPrivateKey(
        new StringValueObject(identity.encryptedKeyPair.encryptedPrivateKey),
      ),
    );
  }

  private messagesPath(conversationId: string, before?: null | string): string {
    const query = new URLSearchParams({ limit: '30' });

    if (before) {
      query.set('beforeMessageId', before);
    }

    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages?${query.toString()}`;
  }

  private async postConversation(
    session: Session,
    peerIdentityId: string,
    published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    },
  ): Promise<ConversationResource> {
    const body = {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
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

    return this.conversations.normalize(created, peerIdentityId);
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
    if (conversationId === keyEntry.conversationId) {
      return keychain;
    }

    return {
      ...keychain,
      conversations: {
        ...keychain.conversations,
        [conversationId]: { ...keyEntry, conversationId },
      },
    };
  }
}
