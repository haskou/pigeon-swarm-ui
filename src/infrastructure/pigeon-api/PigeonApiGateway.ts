import {
  EncryptedPayload,
  EncryptedKeyPair,
  EncryptedPrivateKey,
  KeyPair,
  PrivateKey,
  PublicKey,
  StringValueObject,
  UUID,
} from '@haskou/value-objects';

import type { IdentityUpdateProfileInput } from '../../domain/identities/IdentitySignaturePayloadFactory';
import type {
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  AttachmentProgress,
  IdentityResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  MessageAttachment,
  MessageResource,
  NotificationResource,
  PendingMessageAttachment,
  PrivateFileContent,
  PrivateFileUpload,
  PublicFileContent,
  PublicFileUpload,
  Session,
} from '../../domain/types';

import { API_SERVER_URL } from '../../config';
import { AttachmentCipher } from '../../domain/attachments/AttachmentCipher';
import { ConversationIdFactory } from '../../domain/conversations/ConversationIdFactory';
import { conversationKeyEntry } from '../../domain/conversations/conversationKey';
import { IdentitySignaturePayloadFactory } from '../../domain/identities/IdentitySignaturePayloadFactory';
import { KeychainCipher } from '../../domain/keychains/KeychainCipher';
import { MessageProjector } from '../../domain/messages/MessageProjector';
import { MessageSignaturePayloadFactory } from '../../domain/messages/MessageSignaturePayloadFactory';
import { copy } from '../../i18n/en';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { HttpJsonClient } from '../http/HttpJsonClient';
import { HttpJsonError } from '../http/HttpJsonError';
import { ConversationMapper } from './ConversationMapper';
import { RequestSigner } from './RequestSigner';

const defaultKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonApiGateway {
  private readonly attachmentCipher: AttachmentCipher;

  private readonly conversations: ConversationMapper;

  private readonly http: HttpJsonClient;

  private readonly ids: ConversationIdFactory;

  private readonly identitySignatures: IdentitySignaturePayloadFactory;

  private readonly keychains: KeychainCipher;

  private readonly messages: MessageProjector;

  private readonly messageSignatures: MessageSignaturePayloadFactory;

  private readonly signer: RequestSigner;

  public constructor(
    http: HttpJsonClient = new HttpJsonClient(
      new ApiUrlBuilder(API_SERVER_URL),
    ),
    signer: RequestSigner = new RequestSigner(),
    conversations: ConversationMapper = new ConversationMapper(),
    messages: MessageProjector = new MessageProjector(copy.messages),
    keychains: KeychainCipher = new KeychainCipher(),
    ids: ConversationIdFactory = new ConversationIdFactory(),
    attachmentCipher: AttachmentCipher = new AttachmentCipher(),
  ) {
    this.attachmentCipher = attachmentCipher;
    this.conversations = conversations;
    this.http = http;
    this.ids = ids;
    this.identitySignatures = new IdentitySignaturePayloadFactory();
    this.keychains = keychains;
    this.messageSignatures = new MessageSignaturePayloadFactory();
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

  public async claimNode(session: Session): Promise<void> {
    const path = '/node/owner';
    const body = { identityId: session.identity.id };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async getNodeNetworks(): Promise<
    { id: string; key?: null | string; name: string }[]
  > {
    const result = await this.http.request<{
      networks: { id: string; key?: null | string; name: string }[];
    }>('/node/networks/');

    return result.networks;
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.http.request<PublicFileContent>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    return await this.http.request<PrivateFileContent>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
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
    const serverKeyEntry = { ...keyEntry, conversationId: conversation.id };

    await this.createConversationInvitation(
      session,
      peerIdentity,
      serverKeyEntry,
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
    handle?: string,
  ): Promise<IdentityResource> {
    return await this.http.request<IdentityResource>('/identities/', {
      body: JSON.stringify({
        handle,
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

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
  ): Promise<IdentityResource> {
    const currentIdentity = await this.getIdentity(session.identity.id);
    const previousIdentityExternalIdentifier =
      currentIdentity.identityExternalIdentifier ??
      currentIdentity.previousIdentityExternalIdentifier ??
      session.identity.identityExternalIdentifier ??
      session.identity.previousIdentityExternalIdentifier;

    if (!previousIdentityExternalIdentifier) {
      throw new Error(copy.profile.missingIdentityExternalIdentifier);
    }

    const path = `/identities/${encodeURIComponent(session.identity.id)}`;
    const unsigned = this.identitySignatures.createUpdate({
      identity: currentIdentity,
      previousIdentityExternalIdentifier,
      profile,
      timestamp: Date.now(),
    });
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(unsigned),
      session.password,
    );
    const body = {
      ...unsigned,
      signature: signature.toString(),
    };

    return await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async uploadPublicFile(
    session: Session,
    file: File,
  ): Promise<PublicFileUpload> {
    const path = '/ipfs/public';
    const bytes = await file.arrayBuffer();

    return await this.http.request<PublicFileUpload>(path, {
      body: bytes,
      headers: {
        ...(await this.signer.headers(session, 'POST', path, bytes)),
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': file.name || 'upload',
      },
      method: 'POST',
    });
  }

  public async uploadPrivateFile(
    session: Session,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    const path = '/ipfs/private';

    return await this.http.request<PrivateFileUpload>(path, {
      body: attachment.encryptedBytes,
      headers: {
        ...(await this.signer.headers(
          session,
          'POST',
          path,
          attachment.encryptedBytes,
        )),
        'Content-Type': 'application/octet-stream',
        'X-Filename': attachment.uploadFilename,
      },
      method: 'POST',
    });
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    const content = await this.getPrivateFile(attachment.cid);
    const encryptedBytes = this.attachmentCipher.base64ToBytes(
      content.encryptedData,
    );

    return await this.attachmentCipher.decrypt(
      attachment,
      this.attachmentCipher.bytesToArrayBuffer(encryptedBytes),
      onProgress,
    );
  }

  public async createNetwork(name: string, session?: Session): Promise<void> {
    const path = '/node/networks/';
    const body = {
      id: UUID.generate().toString(),
      key: PrivateKey.generate().toString(),
      name,
    };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'POST', path, body)
        : undefined,
      method: 'POST',
    });
  }

  public async joinNetwork(
    id: string,
    name: string,
    key: string,
    session?: Session,
  ): Promise<void> {
    const path = '/node/networks/';
    const body = { id, key, name };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: session
        ? await this.signer.headers(session, 'POST', path, body)
        : undefined,
      method: 'POST',
    });
  }

  public async listConversations(
    session: Session,
  ): Promise<ConversationResource[]> {
    const path = '/conversations/?limit=30';
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return this.conversations.list(raw);
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    const path = '/notifications/?limit=30';
    const result = await this.http.request<{ results: NotificationResource[] }>(
      path,
      {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      },
    );

    return result.results;
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
      (caught: unknown) => {
        if (this.isMissingRemoteKeychain(caught)) return undefined;

        throw caught;
      },
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
    handle?: string,
  ): Promise<LoginResult> {
    const identity = await this.createIdentity(
      name,
      password,
      networks,
      handle,
    );

    return await this.login(identity.id, password);
  }

  public async sendMessage(
    session: Session,
    conversationId: string,
    content: string,
    previousMessageIds: string[] = [],
    attachments: File[] = [],
    onAttachmentProgress?: (progress: AttachmentProgress) => void,
  ): Promise<ChatMessage> {
    const key = conversationKeyEntry(
      session.keychain,
      session.identity.id,
      conversationId,
      this.ids,
    );

    if (!key) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const timestamp = Date.now();
    const messageAttachments = await this.publishMessageAttachments(
      session,
      attachments,
      onAttachmentProgress,
    );
    const attachmentExternalIdentifiers = messageAttachments.map(
      (attachment) => attachment.cid,
    );
    const encryptedPayload = PublicKey.fromPEM(key.publicKey).encrypt(
      JSON.stringify({
        attachments: messageAttachments,
        authorIdentityId: session.identity.id,
        content,
        conversationId,
        timestamp,
        type: 'MessageSent',
      }),
    );
    const id = `${conversationId}:${timestamp}:${crypto.randomUUID()}`;
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(
        this.messageSignatures.createSent({
          attachmentExternalIdentifiers,
          authorId: session.identity.id,
          conversationId,
          createdAt: timestamp,
          encryptedPayload: encryptedPayload.toString(),
          id,
          previousMessageIds,
        }),
      ),
      session.password,
    );
    const body = {
      attachmentExternalIdentifiers,
      createdAt: timestamp,
      encryptedPayload: encryptedPayload.toString(),
      id,
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

  public async updateNotification(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    const path = `/notifications/${encodeURIComponent(notificationId)}`;
    const body = { state };

    return await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    const decrypted = await session.encryptedKeyPair.decrypt(
      new EncryptedPayload(notification.payload.encryptedConversationKey),
      session.password,
    );
    const keyEntry = JSON.parse(decrypted.toString()) as ConversationKeyEntry;
    const nextKeychain = this.withConversationKey(session.keychain, keyEntry);
    const published = await this.publishKeychain(session, nextKeychain);
    const updated = await this.updateNotification(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      },
      notification.id,
      'accepted',
    );

    return { ...published, notification: updated };
  }

  private async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment[]> {
    if (attachments.length === 0) return [];

    return await Promise.all(
      attachments.map(async (file) => {
        const pending = await this.attachmentCipher.encrypt(file, onProgress);
        const upload = await this.uploadPrivateFile(session, pending);

        return {
          ...pending.metadata,
          cid: upload.cid,
          encryptedSize: upload.size,
        };
      }),
    );
  }

  private isMissingRemoteKeychain(caught: unknown): boolean {
    return (
      caught instanceof HttpJsonError &&
      (caught.code === 'KeychainNotFoundError' ||
        caught.code === 'IdentityNotFoundError')
    );
  }

  private async createConversationInvitation(
    session: Session,
    peerIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
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
    const inviterSignature = await session.encryptedKeyPair.sign(
      JSON.stringify({
        conversationId: keyEntry.conversationId,
        encryptedConversationKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: peerIdentity.id,
      }),
      session.password,
    );
    const body = {
      conversationId: keyEntry.conversationId,
      encryptedConversationKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: peerIdentity.id,
      type: 'conversation_invitation',
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
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
