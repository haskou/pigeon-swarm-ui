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

import type { Peer } from '../../application/peers/ListPeers';
import type {
  CallIceServerConfig,
  CallResource,
  CallSignalPayload,
} from '../../domain/calls/CallSession';
import type { IdentityUpdateProfileInput } from '../../domain/identities/IdentitySignaturePayloadFactory';
import type {
  ChatMessage,
  Community,
  CommunityChannel,
  CommunityInviteLinkResource,
  CommunityTextChannel,
  CommunityVoiceChannel,
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
  SendMessageOptions,
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
import { normalizeIdentityId } from '../../utils/identityId';
import { ApiUrlBuilder } from '../http/ApiUrlBuilder';
import { HttpJsonClient } from '../http/HttpJsonClient';
import { HttpJsonError } from '../http/HttpJsonError';
import { ConversationMapper } from './ConversationMapper';
import { PigeonCallsApi } from './PigeonCallsApi';
import { PigeonFilesApi } from './PigeonFilesApi';
import { RequestSigner } from './RequestSigner';

const defaultKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

type ConversationInvitationType =
  | 'conversation_invitation'
  | 'group_conversation_invitation';

export class PigeonApiGateway {
  private readonly calls: PigeonCallsApi;

  private readonly conversations: ConversationMapper;

  private readonly files: PigeonFilesApi;

  private readonly http: HttpJsonClient;

  private readonly ids: ConversationIdFactory;

  private readonly identitySignatures: IdentitySignaturePayloadFactory;

  private readonly keychains: KeychainCipher;

  private readonly messages: MessageProjector;

  private readonly messageSignatures: MessageSignaturePayloadFactory;

  private readonly requestCache = new Map<string, Promise<unknown>>();

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
    this.calls = new PigeonCallsApi(http, signer);
    this.conversations = conversations;
    this.files = new PigeonFilesApi(http, signer, attachmentCipher);
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
    return await this.cachedRequest('GET /node/', () =>
      this.http.request<{ id: string; owner: string | null }>('/node/'),
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

  public async getNodeNetworks(
    session?: Session,
  ): Promise<{ id: string; key?: null | string; name: string }[]> {
    const path = '/node/networks/';
    const result = await this.cachedRequest(
      `GET ${path} ${session?.identity.id ?? 'anonymous'}`,
      async () =>
        await this.http.request<{
          networks: { id: string; key?: null | string; name: string }[];
        }>(path, {
          headers: session
            ? await this.signer.headers(session, 'GET', path)
            : undefined,
          method: 'GET',
        }),
    );

    return result.networks;
  }

  public async getPeers(): Promise<Peer[]> {
    const result = await this.cachedRequest('GET /peers/', () =>
      this.http.request<{ peers: Peer[] }>('/peers/'),
    );

    return result.peers;
  }

  public async listCalls(session: Session): Promise<CallResource[]> {
    return await this.calls.list(session);
  }

  public async getCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.calls.get(session, callId);
  }

  public async getCallIceServers(
    session: Session,
  ): Promise<CallIceServerConfig> {
    return await this.calls.getIceServers(session);
  }

  public async startConversationCall(
    session: Session,
    conversationId: string,
  ): Promise<CallResource> {
    return await this.calls.startConversation(session, conversationId);
  }

  public async startCommunityChannelCall(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource> {
    return await this.calls.startCommunityChannel(
      session,
      communityId,
      channelId,
    );
  }

  public async joinCall(
    session: Session,
    callId: string,
  ): Promise<CallResource> {
    return await this.calls.join(session, callId);
  }

  public async leaveCall(session: Session, callId: string): Promise<void> {
    await this.calls.leave(session, callId);
  }

  public async endCall(session: Session, callId: string): Promise<void> {
    await this.calls.end(session, callId);
  }

  public async sendCallSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<void> {
    await this.calls.sendSignal(session, callId, signal);
  }

  public async listCommunities(session: Session): Promise<Community[]> {
    const path = '/communities/';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{ communities: Community[] }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );

    return result.communities;
  }

  public async getCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}`;

    return await this.http.request<Community>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async createCommunity(
    session: Session,
    input: {
      avatar?: string;
      banner?: string;
      description: string;
      name: string;
      networkId: string;
    },
  ): Promise<Community> {
    const path = '/communities/';
    const body = {
      ...(input.avatar ? { avatar: input.avatar } : {}),
      ...(input.banner ? { banner: input.banner } : {}),
      description: input.description,
      name: input.name,
      networkId: input.networkId,
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async updateCommunity(
    session: Session,
    communityId: string,
    input: {
      avatar?: string;
      banner?: string;
      description?: string;
      name?: string;
    },
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}`;
    const body = {
      ...(input.avatar ? { avatar: input.avatar } : {}),
      ...(input.banner ? { banner: input.banner } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async addCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<void> {
    const path = `/communities/${encodeURIComponent(communityId)}/members`;
    const body = { identityId };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async leaveCommunity(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}/members/me`;

    return await this.http.request<Community>(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/members`;
    const result = await this.http.request<{ memberIds: string[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.memberIds;
  }

  public async createCommunityTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/text`;
    const body = { name };

    return await this.http.request<CommunityTextChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async createCommunityVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/voice`;
    const body = { name };

    return await this.http.request<CommunityVoiceChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async listCommunityChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/channels`;
    const result = await this.http.request<{
      channels: CommunityChannel[];
    }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.channels;
  }

  public async renameCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}`;
    const body = { name };

    return await this.http.request<CommunityChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async deleteCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}`;

    return await this.http.request<Community>(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async createCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: {
      attachmentExternalIdentifiers?: string[];
      encryptedPayload: string;
      id?: string;
      timestamp?: number;
    },
  ): Promise<MessageResource> {
    const createdAt = input.timestamp ?? Date.now();
    const id =
      input.id ??
      `${communityId}:${channelId}:${createdAt}:${UUID.generate().toString()}`;
    const attachmentExternalIdentifiers =
      input.attachmentExternalIdentifiers ?? [];
    const signaturePayload = {
      attachmentExternalIdentifiers,
      authorIdentityId: session.identity.id,
      channelId,
      communityId,
      createdAt,
      encryptedPayload: input.encryptedPayload,
      id,
      type: 'sent',
    };
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(signaturePayload),
      session.password,
    );
    const body = {
      attachmentExternalIdentifiers,
      createdAt,
      encryptedPayload: input.encryptedPayload,
      id,
      signature: signature.toString(),
    };
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages`;

    return await this.http.request<MessageResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async listCommunityChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options: { beforeMessageId?: string; limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    const query = new URLSearchParams({
      limit: String(options.limit ?? 50),
    });

    if (options.beforeMessageId) {
      query.set('beforeMessageId', options.beforeMessageId);
    }

    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`;
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<
          | MessageResource[]
          | {
              messages?: MessageResource[];
              nextBeforeMessageId?: null | string;
            }
        >(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );

    return Array.isArray(result)
      ? { messages: result, nextBeforeMessageId: null }
      : {
          messages: result.messages ?? [],
          nextBeforeMessageId: result.nextBeforeMessageId ?? null,
        };
  }

  public async deleteCommunityChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const id = `${communityId}:${channelId}:${createdAt}:${UUID.generate().toString()}:deleted`;
    const signaturePayload = {
      actorIdentityId: session.identity.id,
      channelId,
      communityId,
      createdAt,
      id,
      targetMessageId: messageId,
      type: 'deleted',
    };
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(signaturePayload),
      session.password,
    );
    const body = {
      createdAt,
      id,
      signature: signature.toString(),
    };
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
      messageId,
    )}`;

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async getPublicFile(cid: string): Promise<PublicFileContent> {
    return await this.files.getPublicFile(cid);
  }

  public async getPrivateFile(cid: string): Promise<PrivateFileContent> {
    return await this.files.getPrivateFile(cid);
  }

  public async createConversation(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const peerIdentity = await this.getIdentity(peerIdentityId.trim());
    const keyEntry = await this.createConversationKeyEntry(
      session.identity.id,
      peerIdentity.id,
      networkId,
    );
    const published = await this.publishKeychain(
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

  public async createGroupConversation(
    session: Session,
    input: { name: string; networkId: string; participantIds: string[] },
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const participantIds = uniqueSorted([
      session.identity.id,
      ...input.participantIds,
    ]);
    const conversation = await this.postGroupConversation(session, {
      keychainExternalIdentifier: session.keychainExternalIdentifier ?? null,
      name: input.name.trim(),
      networkId: input.networkId,
      participantIds,
    });
    const keyEntry = await this.createGroupConversationKeyEntry(
      conversation.id,
    );
    const published = await this.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const invitedIdentities = await Promise.all(
      participantIds
        .filter((identityId) => identityId !== session.identity.id)
        .map((identityId) => this.getIdentity(identityId)),
    );

    await Promise.all(
      invitedIdentities.map((identity) =>
        this.createConversationInvitation(
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

  public async createGroupConversationInvitation(
    session: Session,
    conversationId: string,
    recipientIdentityId: string,
  ): Promise<void> {
    const keyEntry = session.keychain.conversations[conversationId];

    if (!keyEntry) {
      throw new Error(copy.messages.missingConversationKey);
    }

    const recipientIdentity = await this.getIdentity(
      recipientIdentityId.trim(),
    );

    await this.createConversationInvitation(
      session,
      recipientIdentity,
      keyEntry,
      'group_conversation_invitation',
    );
  }

  public async createCommunityInvitation(
    session: Session,
    communityId: string,
    recipientIdentityId: string,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const recipientIdentity = await this.getIdentity(
      recipientIdentityId.trim(),
    );
    const existingKeyEntry = session.keychain.conversations[communityId];
    const keyEntry =
      existingKeyEntry ??
      (await this.createGroupConversationKeyEntry(communityId));
    const published =
      existingKeyEntry && session.keychainExternalIdentifier
        ? {
            keychain: session.keychain,
            keychainExternalIdentifier: session.keychainExternalIdentifier,
          }
        : await this.publishKeychain(
            session,
            this.withConversationKey(session.keychain, keyEntry),
          );

    await this.createCommunityInvitationNotification(
      {
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier:
          published.keychainExternalIdentifier ||
          session.keychainExternalIdentifier,
      },
      recipientIdentity,
      keyEntry,
    );
    await this.addCommunityMember(session, communityId, recipientIdentity.id);

    return published;
  }

  public async createCommunityInviteLink(
    session: Session,
    communityId: string,
    input: { expiresAt?: string; maxUses?: number } = {},
  ): Promise<{
    invite: CommunityInviteLinkResource;
    keyEntry: ConversationKeyEntry;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const existingKeyEntry = session.keychain.conversations[communityId];
    const keyEntry =
      existingKeyEntry ??
      (await this.createGroupConversationKeyEntry(communityId));
    const published =
      existingKeyEntry && session.keychainExternalIdentifier
        ? {
            keychain: session.keychain,
            keychainExternalIdentifier: session.keychainExternalIdentifier,
          }
        : await this.publishKeychain(
            session,
            this.withConversationKey(session.keychain, keyEntry),
          );
    const path = `/communities/${encodeURIComponent(communityId)}/invites`;
    const body = {
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(input.maxUses ? { maxUses: input.maxUses } : {}),
    };
    const invite = await this.http.request<CommunityInviteLinkResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    return {
      invite,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      keyEntry,
    };
  }

  public async acceptCommunityInviteLink(
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

  public async acceptCommunityInviteLinkWithKey(
    session: Session,
    inviteToken: string,
    keyEntry: ConversationKeyEntry,
  ): Promise<{
    community: Community;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const nextKeychain = this.withConversationKey(session.keychain, keyEntry);
    const published = await this.publishKeychain(session, nextKeychain);
    const community = await this.acceptCommunityInviteLink(
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

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
  ): Promise<IdentityResource> {
    const keyPair = await KeyPair.generate();
    const encryptedKeyPair = await keyPair.encryptKeyPair(password);
    const encryptedKeyPairPrimitives = encryptedKeyPair.toPrimitives();
    const identityId = normalizeIdentityId(keyPair.toPrimitives().publicKey);
    const path = '/identities/';
    const unsigned = this.identitySignatures.createInitial({
      encryptedKeyPair: encryptedKeyPairPrimitives,
      id: identityId,
      networks,
      profile: { handle, name },
      timestamp: Date.now(),
    });
    const signature = keyPair.sign(JSON.stringify(unsigned));
    const body = {
      ...unsigned,
      signature: signature.toString(),
    };
    const signingSession = {
      encryptedKeyPair,
      identity: {
        ...body,
      },
      keychain: defaultKeychain,
      password,
    } as Session;

    return await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(signingSession, 'POST', path, body),
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
    networkId: string,
  ): string {
    return this.ids.create(leftIdentityId, rightIdentityId, networkId);
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.cachedRequest(`GET /identities/${identityId}`, () =>
      this.http.request<IdentityResource>(
        `/identities/${encodeURIComponent(identityId)}`,
      ),
    );
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
  ): Promise<IdentityResource> {
    const identityId = normalizeIdentityId(session.identity.id);
    const currentIdentity = await this.getIdentity(identityId);
    const previousIdentityExternalIdentifier =
      currentIdentity.identityExternalIdentifier ??
      currentIdentity.previousIdentityExternalIdentifier ??
      session.identity.identityExternalIdentifier ??
      session.identity.previousIdentityExternalIdentifier;

    if (!previousIdentityExternalIdentifier) {
      throw new Error(copy.profile.missingIdentityExternalIdentifier);
    }

    const encryptedKeyPair = newPassword
      ? await this.reEncryptKeyPair(session, newPassword)
      : undefined;
    const path = `/identities/${encodeURIComponent(identityId)}`;
    const unsigned = this.identitySignatures.createUpdate({
      encryptedKeyPair,
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
    return await this.files.uploadPublicFile(session, file);
  }

  public async uploadPrivateFile(
    session: Session,
    attachment: PendingMessageAttachment,
  ): Promise<PrivateFileUpload> {
    return await this.files.uploadPrivateFile(session, attachment);
  }

  public async downloadAttachment(
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<Blob> {
    return await this.files.downloadAttachment(attachment, onProgress);
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

  public async markConversationReadUntil(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/read-until`;
    const body = { messageId };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async listNotifications(
    session: Session,
  ): Promise<NotificationResource[]> {
    const path = '/notifications/?limit=30';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{ results: NotificationResource[] }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );

    return result.results;
  }

  public async loadMessages(
    session: Session,
    conversationId: string,
    before?: null | string,
    limit = 30,
  ): Promise<{ messages: ChatMessage[]; nextCursor?: null | string }> {
    const path = this.messagesPath(conversationId, before, limit);
    const raw = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<unknown>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );
    const normalized = this.messages.list(raw);

    return {
      messages: await Promise.all(
        normalized.messages
          .filter((message) => message.type !== 'deleted')
          .map((message) =>
            this.decryptMessage(session, conversationId, message),
          ),
      ),
      nextCursor: normalized.nextCursor,
    };
  }

  public async loadMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessage | null> {
    const path = this.messagePath(conversationId, messageId);
    const message = await this.http.request<MessageResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    if (message.type === 'deleted') return null;

    return await this.decryptMessage(session, conversationId, message);
  }

  public async loadMessagesAround(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<{
    messages: ChatMessage[];
    nextCursor?: null | string;
    previousCursor?: null | string;
  }> {
    const path = this.messagesAroundPath(conversationId, messageId);
    const raw = await this.http.request<unknown>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
    const envelope = raw as {
      messages?: MessageResource[];
      nextCursor?: null | string;
      previousCursor?: null | string;
    };
    const messages = envelope.messages ?? [];

    return {
      messages: await Promise.all(
        messages
          .filter((message) => message.type !== 'deleted')
          .map((message) =>
            this.decryptMessage(session, conversationId, message),
          ),
      ),
      nextCursor: envelope.nextCursor ?? null,
      previousCursor: envelope.previousCursor ?? null,
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

    try {
      await encryptedKeyPair.sign(
        new StringValueObject(`pigeon-swarm:login:${identity.id}`),
        new StringValueObject(password),
      );
    } catch {
      throw new Error(copy.auth.invalidLogin);
    }

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
    options: SendMessageOptions = {},
  ): Promise<ChatMessage> {
    const {
      attachments = [],
      onAttachmentProgress,
      previousMessageIds = [],
      replyPreview,
      replyToMessageId,
    } = options;
    const key = conversationKeyEntry(
      session.keychain,
      session.identity.id,
      conversationId,
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
        ...(replyPreview ? { reply: replyPreview } : {}),
        timestamp,
        type: 'MessageSent',
      }),
    );
    const id = `${conversationId}:${timestamp}:${UUID.generate().toString()}`;
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
          replyToMessageId,
        }),
      ),
      session.password,
    );
    const body = {
      attachmentExternalIdentifiers,
      createdAt: timestamp,
      encryptedPayload: encryptedPayload.toString(),
      id,
      previousMessageIds,
      ...(replyToMessageId ? { replyToMessageId } : {}),
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

  public async deleteMessage(
    session: Session,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const createdAt = Date.now();
    const id = `${conversationId}:${createdAt}:${UUID.generate().toString()}:deleted`;
    const signature = await session.encryptedKeyPair.sign(
      JSON.stringify(
        this.messageSignatures.createDeleted({
          authorId: session.identity.id,
          conversationId,
          createdAt,
          id,
          targetMessageId: messageId,
        }),
      ),
      session.password,
    );
    const body = {
      createdAt,
      id,
      signature: signature.toString(),
    };
    const path = `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async addMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const path = this.messageReactionsPath(conversationId, messageId);
    const body = { emoji };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async removeMessageReaction(
    session: Session,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const path = this.messageReactionsPath(conversationId, messageId);
    const body = { emoji };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
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
    if (notification.type === 'missed_call') {
      throw new Error('Missed call notifications cannot be accepted.');
    }

    const encryptedKey =
      notification.type === 'community_invitation'
        ? notification.payload.encryptedCommunityKey
        : notification.payload.encryptedConversationKey;
    const decrypted = await session.encryptedKeyPair.decrypt(
      new EncryptedPayload(encryptedKey),
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

  public async publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
  ): Promise<MessageAttachment[]> {
    return await this.files.publishMessageAttachments(
      session,
      attachments,
      onProgress,
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
    type: ConversationInvitationType = 'conversation_invitation',
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
      type,
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  private async createCommunityInvitationNotification(
    session: Session,
    recipientIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
  ): Promise<void> {
    const path = '/notifications/';
    const encryptedCommunityKey = PublicKey.fromPEM(
      recipientIdentity.encryptedKeyPair.publicKey,
    )
      .encrypt(JSON.stringify(keyEntry))
      .toString();
    const inviterSignature = await session.encryptedKeyPair.sign(
      JSON.stringify({
        communityId: keyEntry.conversationId,
        encryptedCommunityKey,
        inviterIdentityId: session.identity.id,
        recipientIdentityId: recipientIdentity.id,
      }),
      session.password,
    );
    const body = {
      communityId: keyEntry.conversationId,
      encryptedCommunityKey,
      inviterIdentityId: session.identity.id,
      inviterSignature: inviterSignature.toString(),
      recipientIdentityId: recipientIdentity.id,
      type: 'community_invitation',
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
    networkId: string,
  ): Promise<ConversationKeyEntry> {
    const conversationKeyPair = await KeyPair.generate();
    const keyPairPrimitives = conversationKeyPair.toPrimitives();
    const conversationId = this.deterministicConversationId(
      identityId,
      peerIdentityId,
      networkId,
    );

    return {
      conversationId,
      createdAt: Date.now(),
      peerIdentityId,
      privateKey: keyPairPrimitives.privateKey,
      publicKey: keyPairPrimitives.publicKey,
    };
  }

  private async createGroupConversationKeyEntry(
    conversationId: string,
  ): Promise<ConversationKeyEntry> {
    const conversationKeyPair = await KeyPair.generate();
    const keyPairPrimitives = conversationKeyPair.toPrimitives();

    return {
      conversationId,
      createdAt: Date.now(),
      peerIdentityId: '',
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

  private async reEncryptKeyPair(
    session: Session,
    newPassword: string,
  ): Promise<IdentityResource['encryptedKeyPair']> {
    const privateKey = await new EncryptedPrivateKey(
      new StringValueObject(
        session.identity.encryptedKeyPair.encryptedPrivateKey,
      ),
    ).decrypt(new StringValueObject(session.password));
    const encryptedKeyPair = await EncryptedKeyPair.encryptKeyPair(
      PublicKey.fromPEM(
        new StringValueObject(session.identity.encryptedKeyPair.publicKey),
      ),
      privateKey,
      new StringValueObject(newPassword),
    );

    return encryptedKeyPair.toPrimitives();
  }

  private messagesPath(
    conversationId: string,
    before?: null | string,
    limit = 30,
  ): string {
    const query = new URLSearchParams({ limit: `${limit}` });

    if (before) {
      query.set('beforeMessageId', before);
    }

    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages?${query.toString()}`;
  }

  private messagePath(conversationId: string, messageId: string): string {
    return `/conversations/${encodeURIComponent(
      conversationId,
    )}/messages/${encodeURIComponent(messageId)}`;
  }

  private messageReactionsPath(
    conversationId: string,
    messageId: string,
  ): string {
    return `${this.messagePath(conversationId, messageId)}/reactions`;
  }

  private messagesAroundPath(
    conversationId: string,
    messageId: string,
  ): string {
    const query = new URLSearchParams({ after: '20', before: '20' });

    return `${this.messagePath(
      conversationId,
      messageId,
    )}/around?${query.toString()}`;
  }

  private async cachedRequest<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = this.requestCache.get(key) as Promise<T> | undefined;

    if (cached) return await cached;

    const request = Promise.resolve()
      .then(loader)
      .finally(() => {
        this.requestCache.delete(key);
      });

    this.requestCache.set(key, request);

    return await request;
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

    return this.conversations.normalize(created);
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
