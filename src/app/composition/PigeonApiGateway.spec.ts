import { EncryptedPayload, KeyPair, SymmetricKey } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  IdentityResource,
  LocalKeychain,
  PendingMessageAttachment,
  Session,
  StickerInput,
} from '../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../shared/infrastructure/http/RequestSigner';

import { AttachmentCipher } from '../../contexts/attachments/infrastructure/crypto/AttachmentCipher';
import { decryptCommunityInviteKey } from '../../contexts/communities/infrastructure/crypto/communityInviteKeyEnvelope';
import { RecoveryKey } from '../../contexts/identities/domain/value-objects/RecoveryKey';
import {
  loadLocalPasskeyUnlock,
  saveLocalPasskeyUnlock,
} from '../../contexts/identities/infrastructure/storage/localPasskeyUnlock';
import { PigeonApiGateway } from './PigeonApiGateway';

describe(PigeonApiGateway.name, () => {
  const symmetricFixtureKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

  function conversationKeyEntry(
    conversationId: string,
    peerIdentityId = 'identity-2',
    kind: ConversationKeyEntry['kind'] = 'conversation',
  ): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId,
      createdAt: 1,
      key: symmetricFixtureKey,
      kind,
      peerIdentityId,
      version: 2,
    };
  }

  function decryptFixturePayload(
    encryptedPayload: string,
  ): Record<string, unknown> {
    return JSON.parse(
      SymmetricKey.fromBase64(symmetricFixtureKey)
        .decrypt(new EncryptedPayload(encryptedPayload))
        .toString(),
    ) as Record<string, unknown>;
  }

  function unlockedKeyPair(signature: string): Pick<KeyPair, 'sign'> {
    return {
      sign: jest.fn().mockReturnValue({
        toString: () => signature,
      }),
    } as unknown as Pick<KeyPair, 'sign'>;
  }

  it('loads node networks anonymously when no session is available', async () => {
    const response = {
      networks: [{ id: 'network-1', key: null, name: 'Public Swarm' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn(),
    } as unknown as RequestSigner;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getNodeNetworks()).resolves.toBe(response.networks);

    expect(signer.headers).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('/node/networks/', {
      headers: undefined,
      method: 'GET',
    });
  });

  it('loads node networks with signed identity headers when a session is available', async () => {
    const response = {
      networks: [{ id: 'network-1', key: 'network-key', name: 'Private' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getNodeNetworks(session)).resolves.toBe(
      response.networks,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/node/networks/',
    );
    expect(http.request).toHaveBeenCalledWith('/node/networks/', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('creates a public node network anonymously', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn(),
    } as unknown as RequestSigner;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.createPublicNetwork()).resolves.toBeUndefined();

    expect(signer.headers).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('/node/networks/public/', {
      headers: undefined,
      method: 'POST',
    });
  });

  it('creates a public node network with owner signature when a session is available', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.createPublicNetwork(session)).resolves.toBeUndefined();

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/node/networks/public/',
    );
    expect(http.request).toHaveBeenCalledWith('/node/networks/public/', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'POST',
    });
  });

  it('removes a node network anonymously', async () => {
    const response = {
      networks: [{ id: 'network-2', key: null, name: 'public' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn(),
    } as unknown as RequestSigner;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.removeNetwork('network-1')).resolves.toBe(
      response.networks,
    );

    expect(signer.headers).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith('/node/networks/network-1/', {
      headers: undefined,
      method: 'DELETE',
    });
  });

  it('removes a node network with owner signature when a session is available', async () => {
    const response = {
      networks: [{ id: 'network-2', key: 'key', name: 'private' }],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.removeNetwork('network-1', session)).resolves.toBe(
      response.networks,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'DELETE',
      '/node/networks/network-1/',
      {},
    );
    expect(http.request).toHaveBeenCalledWith('/node/networks/network-1/', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'DELETE',
    });
  });

  it('loads conversation message threads without signing query parameters', async () => {
    const rawMessage = {
      id: 'reply-1',
      replyToMessageId: 'message-1',
      type: 'sent',
    };
    const projectedMessage = {
      attachments: [],
      authorIdentityId: 'identity-2',
      content: 'reply',
      encrypted: true,
      id: 'reply-1',
      mine: false,
      raw: rawMessage,
      reactions: [],
      replyToMessageId: 'message-1',
      timestamp: 1770000000000,
    };
    const http = {
      request: jest.fn().mockResolvedValue({
        messages: [rawMessage],
        nextBeforeMessageId: 'reply-1',
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const messages = {
      toChatMessage: jest.fn().mockResolvedValue(projectedMessage),
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      messages as never,
    );

    await expect(
      gateway.loadMessageThread(session, 'conversation-1', 'message-1'),
    ).resolves.toEqual({
      messages: [projectedMessage],
      nextBeforeMessageId: 'reply-1',
    });

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/conversations/conversation-1/messages/message-1/thread',
    );
    expect(http.request).toHaveBeenCalledWith(
      '/conversations/conversation-1/messages/message-1/thread?limit=50',
      {
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'GET',
      },
    );
  });

  it('pins and unpins conversation messages without request bodies', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/conversations/conversation-1/messages/message-1/pin';

    await gateway.pinMessage(session, 'conversation-1', 'message-1');
    await gateway.unpinMessage(session, 'conversation-1', 'message-1');

    expect(signer.headers).toHaveBeenNthCalledWith(1, session, 'POST', path);
    expect(signer.headers).toHaveBeenNthCalledWith(2, session, 'DELETE', path);
    expect(http.request).toHaveBeenNthCalledWith(1, path, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'POST',
    });
    expect(http.request).toHaveBeenNthCalledWith(2, path, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'DELETE',
    });
  });

  it('deduplicates repeated startup conversation list reads', async () => {
    const response = {
      conversations: [
        {
          id: 'conversation-1',
          networkId: 'network-1',
          participantIdentityIds: ['identity-1', 'identity-2'],
        },
      ],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.listConversations(session)).resolves.toHaveLength(1);
    await expect(gateway.listConversations(session)).resolves.toHaveLength(1);

    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/conversations/?limit=30', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('deduplicates repeated startup draft reads', async () => {
    const response = { drafts: [] };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.listConversationDrafts(session)).resolves.toEqual([]);
    await expect(gateway.listConversationDrafts(session)).resolves.toEqual([]);

    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/conversations/me/drafts', {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('invalidates cached conversation pins after pinning', async () => {
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ pins: [] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ pins: [] }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const pinsPath = '/conversations/conversation-1/pins';
    const pinPath = '/conversations/conversation-1/messages/message-1/pin';

    await expect(
      gateway.listMessagePins(session, 'conversation-1'),
    ).resolves.toEqual([]);
    await expect(
      gateway.listMessagePins(session, 'conversation-1'),
    ).resolves.toEqual([]);
    await gateway.pinMessage(session, 'conversation-1', 'message-1');
    await expect(
      gateway.listMessagePins(session, 'conversation-1'),
    ).resolves.toEqual([]);

    expect(http.request).toHaveBeenCalledTimes(3);
    expect(http.request).toHaveBeenNthCalledWith(1, pinsPath, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
    expect(http.request).toHaveBeenNthCalledWith(2, pinPath, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'POST',
    });
    expect(http.request).toHaveBeenNthCalledWith(3, pinsPath, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('stores conversation drafts as encrypted local payloads', async () => {
    const http = {
      request: jest.fn().mockResolvedValue({
        conversationId: 'conversation-1',
        encryptedPayload: 'encrypted-draft',
        updatedAt: 1770000000000,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: {
        encryptedKeyPair: { publicKey: 'public-key' },
        id: 'identity-1',
      },
      masterKey: {
        decrypt: jest.fn().mockReturnValue({
          toString: () => JSON.stringify({ content: 'draft text' }),
        }),
        encrypt: jest.fn().mockReturnValue({
          toString: () => 'encrypted-draft-payload',
        }),
      },
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.saveConversationDraft(
        session,
        'conversation-1',
        'draft text',
        1770000000000,
      ),
    ).resolves.toMatchObject({
      content: 'draft text',
      conversationId: 'conversation-1',
      updatedAt: 1770000000000,
    });

    const body = JSON.parse(
      ((http.request as jest.Mock).mock.calls[0] as [string, RequestInit])[1]
        .body as string,
    ) as { encryptedPayload: string; updatedAt: number };

    expect(body.encryptedPayload).toEqual(expect.any(String));
    expect(body.updatedAt).toBe(1770000000000);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/conversations/conversation-1/draft',
      body,
    );
  });

  it('loads remote keychains with encoded identity paths and empty signed body', async () => {
    const keychain = {
      encryptedPayload: 'encrypted-keychain',
      keychainExternalIdentifier: 'keychain-1',
      ownerIdentityId: 'identity/with+symbols=',
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };
    const http = {
      request: jest.fn().mockResolvedValue(keychain),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity/with+symbols=' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/keychains/identity%2Fwith%2Bsymbols%3D';

    await expect(gateway.loadRemoteKeychain(session)).resolves.toBe(keychain);

    expect(signer.headers).toHaveBeenCalledWith(session, 'GET', path);
    expect(http.request).toHaveBeenCalledWith(path, {
      headers: { 'X-Identity-Id': 'identity-1' },
      method: 'GET',
    });
  });

  it('creates communities with signed metadata payload', async () => {
    const community = {
      autoJoinEnabled: true,
      avatar: 'bafy-avatar',
      banner: 'bafy-banner',
      createdAt: 1,
      description: 'Description',
      discoverable: false,
      id: 'community-1',
      memberIds: ['identity-1'],
      name: 'Mi comunidad',
      networkId: 'network-1',
      ownerIdentityId: 'identity-1',
      textChannels: [],
      visibility: 'private',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(community),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.createCommunity(session, {
        autoJoinEnabled: true,
        avatar: 'bafy-avatar',
        banner: 'bafy-banner',
        description: 'Description',
        discoverable: false,
        name: 'Mi comunidad',
        networkId: 'network-1',
      }),
    ).resolves.toBe(community);

    const body = {
      autoJoinEnabled: true,
      avatar: 'bafy-avatar',
      banner: 'bafy-banner',
      description: 'Description',
      discoverable: false,
      name: 'Mi comunidad',
      networkId: 'network-1',
    };

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/communities/',
      body,
    );
    expect(http.request).toHaveBeenCalledWith('/communities/', {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('updates community discovery visibility with signed metadata payload', async () => {
    const community = {
      autoJoinEnabled: true,
      createdAt: 1,
      description: 'Description',
      discoverable: false,
      id: 'community-1',
      memberIds: ['identity-1'],
      name: 'Mi comunidad',
      networkId: 'network-1',
      ownerIdentityId: 'identity-1',
      textChannels: [],
      visibility: 'private',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(community),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateCommunity(session, 'community-1', {
        autoJoinEnabled: true,
        description: 'Description',
        discoverable: false,
        name: 'Mi comunidad',
      }),
    ).resolves.toBe(community);

    const body = {
      autoJoinEnabled: true,
      description: 'Description',
      discoverable: false,
      name: 'Mi comunidad',
    };

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PATCH',
      '/communities/community-1',
      body,
    );
    expect(http.request).toHaveBeenCalledWith('/communities/community-1', {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PATCH',
    });
  });

  it('discovers communities with signed query metadata', async () => {
    const response = {
      communities: [
        {
          description: 'Description',
          id: 'community-1',
          memberCount: 2,
          membershipStatus: 'none',
          name: 'Community',
          networkId: 'network-1',
          ownerIdentityId: 'identity-2',
          visibility: 'private',
        },
      ],
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.discoverCommunities(session, {
        networkId: 'network-1',
        query: 'com',
      }),
    ).resolves.toBe(response.communities);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/communities/discover',
      {},
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/discover?query=com&networkId=network-1',
      {
        headers: { 'X-Signature': 'http-signature' },
        method: 'GET',
      },
    );
  });

  it('creates community join requests', async () => {
    const request = {
      communityId: 'community-1',
      createdAt: 1,
      creatorIdentityId: 'identity-1',
      id: 'request-1',
      identityId: 'identity-1',
      status: 'pending',
      type: 'request',
      updatedAt: 1,
    };
    const http = {
      request: jest.fn().mockResolvedValue(request),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.createCommunityJoinRequest(session, 'community-1'),
    ).resolves.toBe(request);

    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/join-requests',
      {
        body: JSON.stringify({}),
        headers: { 'X-Signature': 'http-signature' },
        method: 'POST',
      },
    );
  });

  it('updates community membership requests', async () => {
    const request = {
      communityId: 'community-1',
      createdAt: 1,
      creatorIdentityId: 'identity-1',
      id: 'request-1',
      identityId: 'identity-2',
      status: 'accepted',
      type: 'invitation',
      updatedAt: 2,
    };
    const http = {
      request: jest.fn().mockResolvedValue(request),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-2' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateCommunityMembershipRequest(
        session,
        'request-1',
        'accepted',
      ),
    ).resolves.toBe(request);

    expect(http.request).toHaveBeenCalledWith(
      '/communities/membership-requests/request-1',
      {
        body: JSON.stringify({ status: 'accepted' }),
        headers: { 'X-Signature': 'http-signature' },
        method: 'PATCH',
      },
    );
  });

  it('sends call participant heartbeat', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await gateway.heartbeatCallParticipant(session, 'call-1');

    expect(http.request).toHaveBeenCalledWith(
      '/calls/call-1/participants/me/heartbeat',
      {
        body: JSON.stringify({}),
        headers: { 'X-Signature': 'http-signature' },
        method: 'POST',
      },
    );
  });

  it('loads IPFS replication status with signed identity headers', async () => {
    const response = {
      contents: [
        {
          cid: 'bafy-content',
          context: 'ipfs_private_upload',
          createdAt: 1,
          networks: [
            {
              activeNodeCount: 8,
              desiredReplicas: 5,
              knownReplicaNodeIds: ['node-1'],
              knownReplicas: 1,
              localResponsible: true,
              networkId: 'network-1',
              releaseLocalReplica: false,
              responsibleNodeIds: ['node-1', 'node-2'],
            },
          ],
          ownerIdentityId: 'identity-1',
          priority: 'normal',
          sizeBytes: 215040,
          updatedAt: 2,
        },
      ],
      localNodeId: 'node-1',
    };
    const http = {
      request: jest.fn().mockResolvedValue(response),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/ipfs/replication/status';

    await expect(gateway.getIpfsReplicationStatus(session)).resolves.toBe(
      response,
    );

    expect(signer.headers).toHaveBeenCalledWith(session, 'GET', path, {});
    expect(http.request).toHaveBeenCalledWith(path, {
      headers: { 'X-Signature': 'http-signature' },
      method: 'GET',
    });
  });

  it('leaves communities with a signed member request', async () => {
    const community = {
      createdAt: 1,
      description: 'Description',
      id: 'community-1',
      memberIds: ['identity-2'],
      name: 'Mi comunidad',
      networkId: 'network-1',
      ownerIdentityId: 'identity-2',
      textChannels: [],
      visibility: 'private',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(community),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/communities/community-1/members/me';

    await expect(gateway.leaveCommunity(session, 'community-1')).resolves.toBe(
      community,
    );

    expect(signer.headers).toHaveBeenCalledWith(session, 'DELETE', path);
    expect(http.request).toHaveBeenCalledWith(path, {
      headers: { 'X-Signature': 'http-signature' },
      method: 'DELETE',
    });
  });

  it('creates community text channels with signed owner requests', async () => {
    const channel = {
      createdAt: 1,
      id: 'channel-1',
      name: 'general',
      type: 'text',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(channel),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const body = { name: 'general' };
    const path = '/communities/community-1/channels/text';

    await expect(
      gateway.createCommunityTextChannel(session, 'community-1', 'general'),
    ).resolves.toBe(channel);
    expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('invalidates cached community channel lists after channel mutations', async () => {
    const initialChannels = [
      {
        createdAt: 1,
        id: 'channel-1',
        name: 'general',
        type: 'text',
      },
    ];
    const renamedChannel = {
      createdAt: 1,
      id: 'channel-1',
      name: 'updates',
      type: 'text',
    } as const;
    const updatedChannels = [renamedChannel];
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ channels: initialChannels })
        .mockResolvedValueOnce(renamedChannel)
        .mockResolvedValueOnce({ channels: updatedChannels }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const listPath = '/communities/community-1/channels';
    const renamePath = '/communities/community-1/channels/channel-1';
    const renameBody = { name: 'updates' };

    await expect(
      gateway.listCommunityChannels(session, 'community-1'),
    ).resolves.toEqual(initialChannels);
    await expect(
      gateway.listCommunityChannels(session, 'community-1'),
    ).resolves.toEqual(initialChannels);
    await expect(
      gateway.renameCommunityChannel(
        session,
        'community-1',
        'channel-1',
        'updates',
      ),
    ).resolves.toBe(renamedChannel);
    await expect(
      gateway.listCommunityChannels(session, 'community-1'),
    ).resolves.toEqual(updatedChannels);

    expect(http.request).toHaveBeenCalledTimes(3);
    expect(http.request).toHaveBeenNthCalledWith(1, listPath, {
      headers: { 'X-Signature': 'http-signature' },
      method: 'GET',
    });
    expect(http.request).toHaveBeenNthCalledWith(2, renamePath, {
      body: JSON.stringify(renameBody),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PATCH',
    });
    expect(http.request).toHaveBeenNthCalledWith(3, listPath, {
      headers: { 'X-Signature': 'http-signature' },
      method: 'GET',
    });
  });

  it('creates community channel messages with the canonical domain signature', async () => {
    const createdMessage = {
      attachmentExternalIdentifiers: ['bafy-private'],
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId: 'community-1',
      createdAt: 1234,
      encryptedPayload: 'encrypted-payload',
      id: 'message-1',
      signature: 'domain-signature',
      type: 'sent',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(createdMessage),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      keyPair: unlockedKeyPair('domain-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/communities/community-1/channels/channel-1/messages';
    const body = {
      attachmentExternalIdentifiers: ['bafy-private'],
      createdAt: 1234,
      encryptedPayload: 'encrypted-payload',
      id: 'message-1',
      mentions: [],
      signature: 'domain-signature',
    };

    await expect(
      gateway.createCommunityChannelMessage(
        session,
        'community-1',
        'channel-1',
        {
          attachmentExternalIdentifiers: ['bafy-private'],
          encryptedPayload: 'encrypted-payload',
          id: 'message-1',
          timestamp: 1234,
        },
      ),
    ).resolves.toBe(createdMessage);
    expect(session.keyPair.sign).toHaveBeenCalledWith(
      JSON.stringify({
        attachmentExternalIdentifiers: ['bafy-private'],
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1234,
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        mentions: [],
        type: 'sent',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('edits community channel messages with the canonical domain signature', async () => {
    const editedMessage = {
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId: 'community-1',
      createdAt: 1234,
      editedAt: 5678,
      encryptedPayload: 'edited-encrypted-payload',
      id: 'message-1',
      mentions: [],
      signature: 'domain-signature',
      type: 'sent',
    } as const;
    const http = {
      request: jest.fn().mockResolvedValue(editedMessage),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      keyPair: unlockedKeyPair('domain-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path =
      '/communities/community-1/channels/channel-1/messages/message-1';
    /* eslint-disable perfectionist/sort-objects */
    const body = {
      createdAt: 5678,
      encryptedPayload: 'edited-encrypted-payload',
      signature: 'domain-signature',
      attachmentExternalIdentifiers: [],
      mentions: [],
    };
    /* eslint-enable perfectionist/sort-objects */

    await expect(
      gateway.editCommunityChannelMessage(
        session,
        'community-1',
        'channel-1',
        'message-1',
        {
          encryptedPayload: 'edited-encrypted-payload',
          timestamp: 5678,
        },
      ),
    ).resolves.toBe(editedMessage);
    expect(session.keyPair.sign).toHaveBeenCalledWith(
      JSON.stringify({
        attachmentExternalIdentifiers: [],
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 5678,
        encryptedPayload: 'edited-encrypted-payload',
        id: 'message-1',
        mentions: [],
        type: 'edited',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(session, 'PUT', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PUT',
    });
  });

  it('creates group conversations and stores the key under the server id', async () => {
    const recipientKeyPair = await KeyPair.generate();
    const recipientPublicKey = recipientKeyPair.toPrimitives().publicKey;
    const createdConversation = {
      id: 'group:server-conversation',
      name: 'Mi grupo',
      networkId: 'network-1',
      participantIds: ['identity-1', 'identity-2'],
      type: 'group',
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(createdConversation)
        .mockResolvedValueOnce({
          keychainExternalIdentifier: 'keychain-next',
          ownerIdentityId: 'identity-1',
          version: 2,
        })
        .mockResolvedValueOnce({
          encryptedKeyPair: {
            encryptedPrivateKey: 'encrypted-private-key',
            publicKey: recipientPublicKey,
          },
          id: 'identity-2',
          networks: ['network-1'],
          profile: { name: 'Bob' },
          signature: 'signature',
          timestamp: 1,
          version: 1,
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const keychains = {
      encryptForPublish: jest.fn(
        (_session: Session, nextKeychain: LocalKeychain) =>
          Promise.resolve({
            body: { encryptedPayload: 'encrypted-keychain' },
            keychain: nextKeychain,
          }),
      ),
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      keychainExternalIdentifier: 'keychain-current',
      keyPair: unlockedKeyPair('inviter-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      keychains as never,
    );

    const result = await gateway.createGroupConversation(session, {
      name: 'Mi grupo',
      networkId: 'network-1',
      participantIds: ['identity-2', 'identity-1', 'identity-2'],
    });

    const createBody = {
      keychainExternalIdentifier: 'keychain-current',
      name: 'Mi grupo',
      networkId: 'network-1',
      participantIds: ['identity-1', 'identity-2'],
      type: 'group',
    };

    expect(http.request).toHaveBeenNthCalledWith(1, '/conversations', {
      body: JSON.stringify(createBody),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
    expect(signer.headers).toHaveBeenNthCalledWith(
      1,
      session,
      'POST',
      '/conversations',
      createBody,
    );
    expect(keychains.encryptForPublish).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        conversations: expect.objectContaining({
          'group:server-conversation': expect.objectContaining({
            conversationId: 'group:server-conversation',
          }),
        }),
        version: 1,
      }),
    );
    expect(result.conversation).toMatchObject(createdConversation);
    expect(result.keychain.conversations['group:server-conversation']).toEqual(
      expect.objectContaining({ conversationId: 'group:server-conversation' }),
    );
    expect(result.keychainExternalIdentifier).toBe('keychain-next');
  });

  it('sends the community key invitation when accepting a join request', async () => {
    const recipientKeyPair = await KeyPair.generate();
    const recipientPublicKey = recipientKeyPair.toPrimitives().publicKey;
    const acceptedRequest = {
      communityId: 'community-1',
      createdAt: 1,
      creatorIdentityId: 'identity-2',
      id: 'request-1',
      identityId: 'identity-2',
      status: 'accepted',
      type: 'request',
      updatedAt: 2,
    } as const;
    const recipientIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: recipientPublicKey,
      },
      id: 'identity-2',
      networks: ['network-1'],
      profile: { name: 'Bob' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(acceptedRequest)
        .mockResolvedValueOnce(recipientIdentity)
        .mockResolvedValueOnce({
          createdAt: '2026-01-01',
          id: 'notification-1',
          payload: {},
          recipientIdentityId: 'identity-2',
          state: 'pending',
          status: 'unread',
          type: 'community_invitation',
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'community-1': {
            algorithm: 'aes-256-gcm',
            conversationId: 'community-1',
            createdAt: 1,
            key: symmetricFixtureKey,
            kind: 'community',
            peerIdentityId: '',
            version: 2,
          },
        },
        version: 1,
      },
      keyPair: unlockedKeyPair('inviter-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateCommunityMembershipRequest(
        session,
        'request-1',
        'accepted',
      ),
    ).resolves.toBe(acceptedRequest);

    const requestPath = '/communities/membership-requests/request-1';
    const requestBody = { status: 'accepted' };

    expect(http.request).toHaveBeenNthCalledWith(1, requestPath, {
      body: JSON.stringify(requestBody),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PATCH',
    });
    expect(http.request).toHaveBeenNthCalledWith(2, '/identities/identity-2');

    const notificationCall = (http.request as jest.Mock).mock.calls[2] as [
      string,
      { body: string; headers: Record<string, string>; method: string },
    ];
    const notificationBody = JSON.parse(notificationCall[1].body) as {
      communityId: string;
      encryptedCommunityKey: string;
      inviterIdentityId: string;
      inviterSignature: string;
      recipientIdentityId: string;
      type: string;
    };

    expect(notificationCall[0]).toBe('/notifications/');
    expect(notificationBody).toEqual({
      communityId: 'community-1',
      encryptedCommunityKey: expect.any(String),
      inviterIdentityId: 'identity-1',
      inviterSignature: 'inviter-signature',
      recipientIdentityId: 'identity-2',
      type: 'community_invitation',
    });
    expect(session.keyPair.sign).toHaveBeenCalledWith(
      JSON.stringify({
        communityId: 'community-1',
        encryptedCommunityKey: notificationBody.encryptedCommunityKey,
        inviterIdentityId: 'identity-1',
        recipientIdentityId: 'identity-2',
      }),
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      2,
      session,
      'POST',
      '/notifications/',
      notificationBody,
    );
  });

  it('sends the encrypted community key when inviting a member', async () => {
    const recipientKeyPair = await KeyPair.generate();
    const recipientPublicKey = recipientKeyPair.toPrimitives().publicKey;
    const membershipRequest = {
      communityId: 'community-1',
      createdAt: 1,
      creatorIdentityId: 'identity-1',
      id: 'request-1',
      identityId: 'identity-2',
      status: 'pending',
      type: 'invitation',
      updatedAt: 1,
    } as const;
    const recipientIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: recipientPublicKey,
      },
      id: 'identity-2',
      networks: ['network-1'],
      profile: { name: 'Bob' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(membershipRequest)
        .mockResolvedValueOnce(recipientIdentity)
        .mockResolvedValueOnce({
          createdAt: '2026-01-01',
          id: 'notification-1',
          payload: {},
          recipientIdentityId: 'identity-2',
          state: 'pending',
          status: 'unread',
          type: 'community_invitation',
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const keyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'community-1',
      createdAt: 1,
      key: '12345678901234567890123456789012',
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'community-1': keyEntry,
        },
        version: 1,
      },
      keychainExternalIdentifier: 'keychain-current',
      keyPair: unlockedKeyPair('inviter-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    const result = await gateway.createCommunityInvitation(
      session,
      'community-1',
      'identity-2',
    );

    expect(result).toEqual({
      keychain: session.keychain,
      keychainExternalIdentifier: 'keychain-current',
    });
    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/communities/community-1/members',
      {
        body: JSON.stringify({ identityId: 'identity-2' }),
        headers: { 'X-Signature': 'http-signature' },
        method: 'POST',
      },
    );

    const notificationCall = (http.request as jest.Mock).mock.calls[2] as [
      string,
      { body: string; headers: Record<string, string>; method: string },
    ];
    const notificationBody = JSON.parse(notificationCall[1].body) as {
      communityId: string;
      encryptedCommunityKey: string;
      inviterIdentityId: string;
      inviterSignature: string;
      recipientIdentityId: string;
      type: string;
    };

    expect(notificationBody).toEqual({
      communityId: 'community-1',
      encryptedCommunityKey: expect.any(String),
      inviterIdentityId: 'identity-1',
      inviterSignature: 'inviter-signature',
      recipientIdentityId: 'identity-2',
      type: 'community_invitation',
    });
  });

  it('accepts group invitations by publishing the decrypted keychain entry', async () => {
    const keyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'group:conversation',
      createdAt: 1,
      key: symmetricFixtureKey,
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    };
    const updatedNotification = {
      createdAt: '2026-01-01',
      id: 'notification-1',
      payload: {
        conversationId: 'group:conversation',
        encryptedConversationKey: 'encrypted-key',
        inviterIdentityId: 'identity-2',
        inviterSignature: 'signature',
        recipientIdentityId: 'identity-1',
      },
      recipientIdentityId: 'identity-1',
      state: 'accepted',
      status: 'read',
      type: 'group_conversation_invitation',
    } as const;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          keychainExternalIdentifier: 'keychain-next',
          ownerIdentityId: 'identity-1',
          version: 1,
        })
        .mockResolvedValueOnce(updatedNotification),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const keychains = {
      encryptForPublish: jest.fn(
        (_session: Session, nextKeychain: LocalKeychain) =>
          Promise.resolve({
            body: { encryptedPayload: 'encrypted-keychain' },
            keychain: nextKeychain,
          }),
      ),
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      keyPair: {
        decrypt: jest.fn().mockResolvedValue({
          toString: () => JSON.stringify(keyEntry),
        }),
      },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      keychains as never,
    );

    const result = await gateway.acceptConversationInvitation(session, {
      createdAt: '2026-01-01',
      id: 'notification-1',
      payload: {
        conversationId: 'group:conversation',
        encryptedConversationKey: 'encrypted-key',
        inviterIdentityId: 'identity-2',
        inviterSignature: 'signature',
        recipientIdentityId: 'identity-1',
      },
      recipientIdentityId: 'identity-1',
      state: 'pending',
      status: 'unread',
      type: 'group_conversation_invitation',
    });

    expect(keychains.encryptForPublish).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        conversations: {
          'group:conversation': keyEntry,
        },
        version: 1,
      }),
    );
    expect(http.request).toHaveBeenNthCalledWith(1, '/keychains/', {
      body: JSON.stringify({ encryptedPayload: 'encrypted-keychain' }),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
    expect(result.keychain.conversations['group:conversation']).toEqual(
      keyEntry,
    );
    expect(result.keychainExternalIdentifier).toBe('keychain-next');
    expect(result.notification).toBe(updatedNotification);
  });

  it('accepts group invitations after local device unlock restored the key pair', async () => {
    const keyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'group:conversation',
      createdAt: 1,
      key: symmetricFixtureKey,
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          keychainExternalIdentifier: 'keychain-next',
          ownerIdentityId: 'identity-1',
          version: 1,
        })
        .mockResolvedValueOnce({
          createdAt: '2026-01-01',
          id: 'notification-1',
          payload: {},
          recipientIdentityId: 'identity-1',
          state: 'accepted',
          status: 'read',
          type: 'group_conversation_invitation',
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const keychains = {
      encryptForPublish: jest.fn(
        (_session: Session, nextKeychain: LocalKeychain) =>
          Promise.resolve({
            body: { encryptedPayload: 'encrypted-keychain' },
            keychain: nextKeychain,
          }),
      ),
    };
    const keyPair = {
      decrypt: jest.fn(() => Buffer.from(JSON.stringify(keyEntry))),
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      keyPair,
      password: '',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      keychains as never,
    );

    const result = await gateway.acceptConversationInvitation(session, {
      createdAt: '2026-01-01',
      id: 'notification-1',
      payload: {
        conversationId: 'group:conversation',
        encryptedConversationKey: 'encrypted-key',
        inviterIdentityId: 'identity-2',
        inviterSignature: 'signature',
        recipientIdentityId: 'identity-1',
      },
      recipientIdentityId: 'identity-1',
      state: 'pending',
      status: 'unread',
      type: 'group_conversation_invitation',
    });

    expect(keyPair.decrypt).toHaveBeenCalledWith(expect.any(EncryptedPayload));
    expect(result.keychain.conversations['group:conversation']).toEqual(
      keyEntry,
    );
  });

  it('publishes the community invite link key before accepting the invite', async () => {
    const keyEntry = {
      algorithm: 'aes-256-gcm' as const,
      conversationId: 'community-1',
      createdAt: 1,
      key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      kind: 'community' as const,
      peerIdentityId: '',
      version: 2 as const,
    };
    const community = {
      createdAt: 1,
      description: 'Description',
      id: 'community-1',
      memberIds: ['identity-1'],
      name: 'Community',
      networkId: 'network-1',
      ownerIdentityId: 'identity-2',
      textChannels: [],
      visibility: 'private',
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          keychainExternalIdentifier: 'keychain-next',
          ownerIdentityId: 'identity-1',
          version: 1,
        })
        .mockResolvedValueOnce(community),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const keychains = {
      encryptForPublish: jest.fn(
        (_session: Session, nextKeychain: LocalKeychain) =>
          Promise.resolve({
            body: { encryptedPayload: 'encrypted-keychain' },
            keychain: nextKeychain,
          }),
      ),
    };
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      keychains as never,
    );

    const result = await gateway.acceptCommunityInviteLinkWithKey(
      session,
      'invite-token',
      keyEntry,
    );

    expect(keychains.encryptForPublish).toHaveBeenCalledWith(
      session,
      expect.objectContaining({
        conversations: {
          'community-1': keyEntry,
        },
        version: 1,
      }),
    );
    expect(http.request).toHaveBeenNthCalledWith(1, '/keychains/', {
      body: JSON.stringify({ encryptedPayload: 'encrypted-keychain' }),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
    expect(http.request).toHaveBeenNthCalledWith(
      2,
      '/communities/invites/invite-token/accept',
      {
        body: JSON.stringify({}),
        headers: { 'X-Signature': 'http-signature' },
        method: 'POST',
      },
    );
    expect(result.community).toBe(community);
    expect(result.keychain.conversations['community-1']).toEqual(keyEntry);
    expect(result.keychainExternalIdentifier).toBe('keychain-next');
  });

  it('creates community invite links with encrypted key envelopes', async () => {
    const keyEntry: ConversationKeyEntry = {
      algorithm: 'aes-256-gcm',
      conversationId: 'community-1',
      createdAt: 1770000000000,
      key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      kind: 'community',
      peerIdentityId: '',
      version: 2,
    };
    const invite = {
      communityId: 'community-1',
      inviteToken: 'invite-token',
      maxUses: 1,
    };
    const http = {
      request: jest.fn().mockResolvedValue(invite),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'community-1': keyEntry,
        },
        version: 1,
      },
      keychainExternalIdentifier: 'keychain-1',
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    const result = await gateway.createCommunityInviteLink(
      session,
      'community-1',
      {
        expiresAt: 1770000000000,
        maxUses: 1,
      },
    );

    expect(result.invite).toBe(invite);
    expect(result.inviteSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(http.request).toHaveBeenCalledTimes(1);
    const [path, options] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string>; method: string },
    ];
    const body = JSON.parse(options.body) as {
      encryptedCommunityKey: Parameters<typeof decryptCommunityInviteKey>[0];
      expiresAt: number;
      keyEntry?: unknown;
      maxUses: number;
      privateKey?: string;
      publicKey?: string;
    };

    expect(path).toBe('/communities/community-1/invites');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'X-Signature': 'http-signature' });
    expect(body).toMatchObject({
      encryptedCommunityKey: {
        algorithm: 'AES-GCM',
        version: 1,
      },
      expiresAt: 1770000000000,
      maxUses: 1,
    });
    expect(body.keyEntry).toBeUndefined();
    expect(body.privateKey).toBeUndefined();
    expect(body.publicKey).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('PRIVATE KEY');
    expect(result.inviteSecret).toBeDefined();
    const inviteSecret = result.inviteSecret;

    if (!inviteSecret) throw new Error('Expected invite secret.');

    await expect(
      decryptCommunityInviteKey(body.encryptedCommunityKey, inviteSecret),
    ).resolves.toEqual(keyEntry);
  });

  it('does not project deleted messages when loading conversation messages', async () => {
    const http = {
      request: jest.fn().mockResolvedValue({
        messages: [
          { id: 'deleted-message', type: 'deleted' },
          {
            authorIdentityId: 'identity-1',
            content: 'visible',
            id: 'sent-message',
            type: 'sent',
          },
        ],
        nextBeforeMessageId: null,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const messages = {
      list: jest.fn((value: unknown) => value as never),
      toChatMessage: jest.fn().mockResolvedValue({
        authorIdentityId: 'identity-1',
        content: 'visible',
        encrypted: false,
        id: 'sent-message',
        mine: true,
        raw: { id: 'sent-message' },
        reactions: [],
        timestamp: 1,
      }),
    };
    const session = { identity: { id: 'identity-1' } } as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      messages as never,
    );

    await expect(
      gateway.loadMessages(session, 'conversation-1'),
    ).resolves.toMatchObject({
      messages: [{ id: 'sent-message' }],
    });
    expect(messages.toChatMessage).toHaveBeenCalledTimes(1);
    expect(messages.toChatMessage).toHaveBeenCalledWith(
      session,
      'conversation-1',
      expect.objectContaining({ id: 'sent-message' }),
    );
  });

  it('creates identities with a signed client keypair payload', async () => {
    const createdIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'public-key',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16_384,
        p: 5,
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
      networks: ['network-1'],
      profile: { handle: 'ada', name: 'Ada' },
      signature: 'keypair-signature',
      timestamp: 1234,
      version: 1,
    } satisfies IdentityResource;
    const http = {
      request: jest.fn().mockResolvedValue(createdIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const now = jest.spyOn(Date, 'now').mockReturnValue(1234);
    const gateway = new PigeonApiGateway(http, signer);

    try {
      await expect(
        gateway.createIdentity('Ada', 'secret', ['network-1'], ' @Ada '),
      ).resolves.toBe(createdIdentity);
    } finally {
      now.mockRestore();
    }

    const [, postInit] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(postInit.body as string) as Partial<
      IdentityResource & { password?: string }
    >;

    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('previousIdentityExternalIdentifier');
    expect(Object.keys(body)).toEqual([
      'encryptedKeyPair',
      'encryptedMasterKey',
      'id',
      'masterKeyDerivation',
      'networks',
      'profile',
      'timestamp',
      'version',
      'signature',
    ]);
    expect(body).toEqual({
      encryptedKeyPair: {
        encryptedPrivateKey: expect.any(String),
        publicKey: 'public-key',
      },
      encryptedMasterKey: expect.any(String),
      id: 'public-key',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 2 ** 18,
        p: 1,
        r: 8,
        salt: expect.any(String),
        version: 1,
      },
      networks: ['network-1'],
      profile: {
        handle: 'ada',
        name: 'Ada',
      },
      signature: 'keypair-signature',
      timestamp: 1234,
      version: 1,
    });
    expect(
      (body.encryptedKeyPair as IdentityResource['encryptedKeyPair'])
        .encryptedPrivateKey,
    ).not.toBe('encrypted-private-key');
    const signingBody = (signer.headers as jest.Mock).mock.calls[0][3] as
      | IdentityResource
      | undefined;

    expect(Object.keys(signingBody ?? {})).toEqual([
      'encryptedKeyPair',
      'encryptedMasterKey',
      'id',
      'masterKeyDerivation',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'timestamp',
      'version',
      'signature',
    ]);
    expect(signingBody?.previousIdentityExternalIdentifier).toBeUndefined();
    const signingSession = (signer.headers as jest.Mock).mock.calls[0][0] as
      | Record<string, unknown>
      | undefined;

    expect(signingSession).not.toHaveProperty('password');
    expect(signer.headers).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ id: 'public-key' }),
      }),
      'POST',
      '/identities/',
      signingBody,
    );
    expect(http.request).toHaveBeenCalledWith('/identities/', {
      body: postInit.body,
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('does not fail registration when optional local passkey unlock setup is cancelled', async () => {
    const identity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'public-key',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 2 ** 18,
        p: 1,
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
      networks: ['network-1'],
      profile: { handle: 'ada', name: 'Ada' },
      signature: 'keypair-signature',
      timestamp: 1234,
      version: 1,
    } satisfies IdentityResource;
    const masterKey = SymmetricKey.generate();
    const keyPair = unlockedKeyPair('signature') as unknown as KeyPair;
    const session = {
      identity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey,
    } as unknown as Session;
    const loginResult = { conversations: [], session };
    const gateway = new PigeonApiGateway();
    const internals = gateway as unknown as {
      createIdentityMaterial: jest.Mock;
      hydrateLoginSession: jest.Mock;
      saveLocalPasskeyMasterKeyUnlock: jest.Mock;
    };

    internals.createIdentityMaterial = jest.fn().mockResolvedValue({
      identity,
      keyPair,
      masterKey,
    });
    internals.hydrateLoginSession = jest.fn().mockResolvedValue(loginResult);
    internals.saveLocalPasskeyMasterKeyUnlock = jest
      .fn()
      .mockRejectedValue(new Error('cancelled'));

    await expect(
      gateway.register('Ada', 'secret', ['network-1'], 'ada', {
        passkeyPrfEnabled: true,
      }),
    ).resolves.toBe(loginResult);

    expect(internals.saveLocalPasskeyMasterKeyUnlock).toHaveBeenCalledWith({
      displayName: 'Ada',
      identityId: identity.id,
      masterKey,
      password: 'secret',
    });
  });

  it('does not create a local passkey unlock when registration already protected the identity with passkey PRF', async () => {
    const identity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'public-key',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 2 ** 18,
        p: 1,
        passkeyPrf: {
          algorithm: 'webauthn-prf',
          credentialId: 'credential-id',
          salt: 'salt',
          version: 1,
        },
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
      networks: ['network-1'],
      profile: { handle: 'ada', name: 'Ada' },
      signature: 'keypair-signature',
      timestamp: 1234,
      version: 1,
    } satisfies IdentityResource;
    const masterKey = SymmetricKey.generate();
    const keyPair = unlockedKeyPair('signature') as unknown as KeyPair;
    const session = {
      identity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey,
    } as unknown as Session;
    const loginResult = { conversations: [], session };
    const gateway = new PigeonApiGateway();
    const internals = gateway as unknown as {
      createIdentityMaterial: jest.Mock;
      hydrateLoginSession: jest.Mock;
      saveLocalPasskeyMasterKeyUnlock: jest.Mock;
    };

    internals.createIdentityMaterial = jest.fn().mockResolvedValue({
      identity,
      keyPair,
      masterKey,
    });
    internals.hydrateLoginSession = jest.fn().mockResolvedValue(loginResult);
    internals.saveLocalPasskeyMasterKeyUnlock = jest.fn();

    await expect(
      gateway.register('Ada', 'secret', ['network-1'], 'ada', {
        passkeyPrfEnabled: true,
      }),
    ).resolves.toBe(loginResult);

    expect(internals.saveLocalPasskeyMasterKeyUnlock).not.toHaveBeenCalled();
  });

  it('keeps passkey PRF registration enabled when a recovery key is also created', () => {
    const gateway = new PigeonApiGateway();
    const internals = gateway as unknown as {
      registrationPasskeyPrfMode(input: {
        displayName: string;
        enabled?: boolean;
        identityId: string;
        recoveryKey?: RecoveryKey;
      }): unknown;
    };

    const mode = internals.registrationPasskeyPrfMode({
      displayName: 'Ada',
      enabled: true,
      identityId: 'identity-1',
      recoveryKey: RecoveryKey.generate(),
    });

    expect(mode).toEqual({
      displayName: 'Ada',
      identityId: 'identity-1',
      mode: 'create',
    });
  });

  it('preserves existing passkey PRF during profile updates unless explicitly disabled', () => {
    const gateway = new PigeonApiGateway();
    const passkeyPrf = {
      algorithm: 'webauthn-prf',
      credentialId: 'credential-id',
      salt: 'salt',
      version: 1,
    } satisfies NonNullable<
      IdentityResource['masterKeyDerivation']['passkeyPrf']
    >;
    const currentIdentity = {
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 2 ** 18,
        p: 1,
        passkeyPrf,
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
    } as IdentityResource;
    const internals = gateway as unknown as {
      profilePasskeyPrfMode(input: {
        currentIdentity: IdentityResource;
        enabled?: boolean;
        identityId: string;
        profileName: string;
      }): unknown;
    };

    expect(
      internals.profilePasskeyPrfMode({
        currentIdentity,
        identityId: 'identity-1',
        profileName: 'Ada',
      }),
    ).toEqual({
      mode: 'preserve',
      protection: passkeyPrf,
    });
    expect(
      internals.profilePasskeyPrfMode({
        currentIdentity,
        enabled: false,
        identityId: 'identity-1',
        profileName: 'Ada',
      }),
    ).toBeUndefined();
  });

  it('refreshes the current identity reference before signing profile updates', async () => {
    const currentIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'identity/with+symbols=',
      identityExternalIdentifier: 'current-identity-cid',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16_384,
        p: 5,
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'current-signature',
      timestamp: 1,
      version: 7,
    } satisfies IdentityResource;
    const updatedIdentity = {
      ...currentIdentity,
      identityExternalIdentifier: 'next-identity-cid',
      profile: { biography: 'Hi', handle: 'ada', name: 'Ada Next' },
      version: 8,
    } satisfies IdentityResource;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(currentIdentity)
        .mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: {
        ...currentIdentity,
        identityExternalIdentifier: undefined,
        previousIdentityExternalIdentifier: undefined,
        version: 1,
      },
      keychain: { conversations: {}, version: 0 },
      keyPair: unlockedKeyPair('identity-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.updateIdentityProfile(session, {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      }),
    ).resolves.toBe(updatedIdentity);

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/identities/identity%2Fwith%2Bsymbols%3D',
    );
    const [, putInit] = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(putInit.body as string) as IdentityResource;

    expect(Object.keys(body)).toEqual([
      'encryptedKeyPair',
      'encryptedMasterKey',
      'id',
      'masterKeyDerivation',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'timestamp',
      'version',
      'signature',
    ]);
    expect(body.version).toBe(8);
    expect(body.previousIdentityExternalIdentifier).toBe(
      'current-identity-cid',
    );
    expect(body.signature).toBe('identity-signature');
    const [signedPayload] = (session.keyPair.sign as jest.Mock).mock
      .calls[0] as [string];
    const parsedSignedPayload = JSON.parse(
      signedPayload,
    ) as Partial<IdentityResource>;

    expect(parsedSignedPayload).toEqual({
      encryptedKeyPair: currentIdentity.encryptedKeyPair,
      encryptedMasterKey: currentIdentity.encryptedMasterKey,
      id: currentIdentity.id,
      masterKeyDerivation: currentIdentity.masterKeyDerivation,
      networks: currentIdentity.networks,
      previousIdentityExternalIdentifier: 'current-identity-cid',
      profile: {
        biography: 'Hi',
        handle: 'ada',
        name: 'Ada Next',
      },
      timestamp: expect.any(Number),
      version: 8,
    });
  });

  it('caches identity reads during the startup window', async () => {
    const identity = {
      id: 'identity-1',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;
    const http = {
      request: jest.fn().mockResolvedValue(identity),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);

    await expect(gateway.getIdentity('identity-1')).resolves.toBe(identity);
    await expect(gateway.getIdentity('identity-1')).resolves.toBe(identity);

    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/identities/identity-1');
  });

  it('caches identity reads by the lookup alias and returned identity id', async () => {
    const identity = {
      id: 'identity-1',
      networks: ['network-1'],
      profile: { handle: 'ada', name: 'Ada' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;
    const http = {
      request: jest.fn().mockResolvedValue(identity),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);

    await expect(gateway.getIdentity('@ada')).resolves.toBe(identity);
    await expect(gateway.getIdentity('@ada')).resolves.toBe(identity);
    await expect(gateway.getIdentity('identity-1')).resolves.toBe(identity);

    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/identities/%40ada');
  });

  it('deduplicates concurrent identity reads', async () => {
    const identity = {
      id: 'identity-1',
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'signature',
      timestamp: 1,
      version: 1,
    } as IdentityResource;
    let resolveIdentity!: (identity: IdentityResource) => void;
    const identityPromise = new Promise<IdentityResource>((resolve) => {
      resolveIdentity = resolve;
    });
    const http = {
      request: jest.fn().mockReturnValue(identityPromise),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);
    const first = gateway.getIdentity('identity-1');
    const second = gateway.getIdentity('identity-1');

    resolveIdentity(identity);

    await expect(first).resolves.toBe(identity);
    await expect(second).resolves.toBe(identity);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/identities/identity-1');
  });

  it('refreshes the identity cache after updating the profile', async () => {
    const currentIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      encryptedMasterKey: 'encrypted-master-key',
      id: 'identity-1',
      identityExternalIdentifier: 'current-identity-cid',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16_384,
        p: 5,
        r: 8,
        salt: 'master-salt',
        version: 1,
      },
      networks: ['network-1'],
      profile: { name: 'Ada' },
      signature: 'current-signature',
      timestamp: 1,
      version: 7,
    } satisfies IdentityResource;
    const updatedIdentity = {
      ...currentIdentity,
      identityExternalIdentifier: 'next-identity-cid',
      profile: { name: 'Ada Next' },
      version: 8,
    } satisfies IdentityResource;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(currentIdentity)
        .mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: currentIdentity,
      keychain: { conversations: {}, version: 0 },
      keyPair: unlockedKeyPair('identity-signature'),
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getIdentity('identity-1')).resolves.toBe(
      currentIdentity,
    );
    await expect(
      gateway.updateIdentityProfile(session, { name: 'Ada Next' }),
    ).resolves.toBe(updatedIdentity);
    await expect(gateway.getIdentity('identity-1')).resolves.toBe(
      updatedIdentity,
    );

    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('clears local passkey unlock from the profile security flow', async () => {
    const storage = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.get(key) ?? null),
        removeItem: jest.fn((key: string) => storage.delete(key)),
        setItem: jest.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
      },
    });

    saveLocalPasskeyUnlock({
      encryptedMasterKey: 'encrypted-master-key',
      identityId: 'identity-1',
      masterKeyDerivation: {
        algorithm: 'scrypt',
        N: 16,
        p: 1,
        passkeyPrf: {
          algorithm: 'webauthn-prf',
          credentialId: 'credential-id',
          salt: 'salt',
          version: 1,
        },
        r: 1,
        salt: 'password-salt',
        version: 1,
      },
    });
    const gateway = new PigeonApiGateway();
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;

    await expect(
      gateway.configureLocalPasskeyUnlock(session, '', false),
    ).resolves.toBeUndefined();

    expect(loadLocalPasskeyUnlock('identity-1')).toBeUndefined();
  });

  it('verifies remote recovery factors before saving local passkey unlock', async () => {
    const storage = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.get(key) ?? null),
        removeItem: jest.fn((key: string) => storage.delete(key)),
        setItem: jest.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
      },
    });

    const gateway = new PigeonApiGateway();
    const session = {
      identity: {
        encryptedKeyPair: {
          encryptedPrivateKey: 'encrypted-private-key',
          publicKey: 'identity-recovery',
        },
        encryptedMasterKey: 'encrypted-master-key',
        id: 'identity-recovery',
        masterKeyDerivation: {
          algorithm: 'scrypt',
          N: 2 ** 18,
          p: 1,
          r: 8,
          recoveryKey: {
            algorithm: 'pigeon-recovery-key',
            encryptedMasterKey: 'encrypted-recovery-master-key',
            mode: 'recovery-key',
            version: 1,
          },
          salt: 'master-salt',
          version: 1,
        },
        networks: ['network-1'],
        profile: { name: 'Ada' },
        signature: 'signature',
        timestamp: 1,
        version: 1,
      },
      masterKey: SymmetricKey.generate(),
    } as unknown as Session;

    await expect(
      gateway.configureLocalPasskeyUnlock(
        session,
        'wrong-password',
        true,
        'not-a-recovery-key',
      ),
    ).rejects.toThrow();

    expect(loadLocalPasskeyUnlock('identity-recovery')).toBeUndefined();
  });

  it('uploads public profile files as signed binary bodies', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const upload = {
      cid: 'bafy-avatar',
      contentType: 'image/webp',
      filename: 'avatar.webp',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const file = {
      arrayBuffer: jest.fn().mockResolvedValue(bytes),
      name: 'avatar.webp',
      type: 'image/webp',
    } as unknown as File;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.uploadPublicFile(session, file)).resolves.toBe(upload);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/public', {
      body: bytes,
      headers: {
        'Content-Type': 'image/webp',
        'X-Filename': 'avatar.webp',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('uploads sticker assets as public signed binary bodies', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const upload = {
      cid: 'bafy-sticker',
      contentType: 'image/webp',
      filename: 'smile.webp',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const file = {
      arrayBuffer: jest.fn().mockResolvedValue(bytes),
      name: 'smile.webp',
      type: 'image/webp',
    } as unknown as File;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.uploadStickerAsset(session, file)).resolves.toBe(
      upload,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/public',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/public', {
      body: bytes,
      headers: {
        'Content-Type': 'image/webp',
        'X-Filename': 'smile.webp',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('manages sticker packs through signed owner endpoints', async () => {
    const pack = {
      createdAt: 1,
      id: 'pack-1',
      name: 'Blue archive reactions',
      ownerIdentityId: 'identity-1',
      stickers: [],
      updatedAt: 1,
    };
    const sticker = {
      assetCid: 'bafy-sticker',
      contentType: 'image/png',
      createdAt: 2,
      dimensions: { height: 512, width: 512 },
      id: 'sticker-1',
      sizeBytes: 215040,
      type: 'static' as const,
      updatedAt: 2,
    };
    const stickerInput: StickerInput = {
      assetCid: sticker.assetCid,
      contentType: sticker.contentType,
      dimensions: sticker.dimensions,
      sizeBytes: sticker.sizeBytes,
      type: sticker.type,
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce(pack)
        .mockResolvedValueOnce({ ...pack, name: 'Updated pack' })
        .mockResolvedValueOnce(sticker)
        .mockResolvedValueOnce({ ...sticker, sizeBytes: 215041 })
        .mockResolvedValueOnce(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const packInput = {
      name: pack.name,
    };
    const packUpdate = { name: 'Updated pack' };

    await expect(gateway.createStickerPack(session, packInput)).resolves.toBe(
      pack,
    );
    await expect(
      gateway.updateStickerPack(session, pack.id, packUpdate),
    ).resolves.toEqual({ ...pack, name: 'Updated pack' });
    await expect(
      gateway.addStickerToPack(session, pack.id, stickerInput),
    ).resolves.toBe(sticker);
    await expect(
      gateway.updateSticker(session, pack.id, sticker.id, {
        ...stickerInput,
        sizeBytes: 215041,
      }),
    ).resolves.toEqual({ ...sticker, sizeBytes: 215041 });
    await expect(
      gateway.deleteSticker(session, pack.id, sticker.id),
    ).resolves.toBeUndefined();

    expect(signer.headers).toHaveBeenNthCalledWith(
      1,
      session,
      'POST',
      '/stickers/packs',
      packInput,
    );
    expect(http.request).toHaveBeenNthCalledWith(1, '/stickers/packs', {
      body: JSON.stringify(packInput),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
    expect(signer.headers).toHaveBeenNthCalledWith(
      2,
      session,
      'PATCH',
      '/stickers/packs/pack-1',
      packUpdate,
    );
    expect(http.request).toHaveBeenNthCalledWith(2, '/stickers/packs/pack-1', {
      body: JSON.stringify(packUpdate),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PATCH',
    });
    expect(signer.headers).toHaveBeenNthCalledWith(
      3,
      session,
      'POST',
      '/stickers/packs/pack-1/stickers',
      stickerInput,
    );
    expect(http.request).toHaveBeenNthCalledWith(
      3,
      '/stickers/packs/pack-1/stickers',
      {
        body: JSON.stringify(stickerInput),
        headers: { 'X-Signature': 'http-signature' },
        method: 'POST',
      },
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      4,
      session,
      'PATCH',
      '/stickers/packs/pack-1/stickers/sticker-1',
      { ...stickerInput, sizeBytes: 215041 },
    );
    expect(http.request).toHaveBeenNthCalledWith(
      4,
      '/stickers/packs/pack-1/stickers/sticker-1',
      {
        body: JSON.stringify({ ...stickerInput, sizeBytes: 215041 }),
        headers: { 'X-Signature': 'http-signature' },
        method: 'PATCH',
      },
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      5,
      session,
      'DELETE',
      '/stickers/packs/pack-1/stickers/sticker-1',
    );
    expect(http.request).toHaveBeenNthCalledWith(
      5,
      '/stickers/packs/pack-1/stickers/sticker-1',
      {
        headers: { 'X-Signature': 'http-signature' },
        method: 'DELETE',
      },
    );
  });

  it('lists sticker packs and filters by owner identity', async () => {
    const pack = {
      id: 'pack-1',
      name: 'Reactions',
      ownerIdentityId: 'identity-1',
      stickers: [],
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ results: [pack] })
        .mockResolvedValueOnce({ results: [pack] }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn(),
    } as unknown as RequestSigner;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.listStickerPacks()).resolves.toEqual([pack]);
    await expect(
      gateway.listStickerPacks({ ownerIdentityId: 'identity 1' }),
    ).resolves.toEqual([pack]);

    expect(signer.headers).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenNthCalledWith(1, '/stickers/packs', {
      method: 'GET',
    });
    expect(http.request).toHaveBeenNthCalledWith(
      2,
      '/stickers/packs?ownerIdentityId=identity+1',
      {
        method: 'GET',
      },
    );
  });

  it('loads sticker library and updates saved, favorite and recent stickers', async () => {
    const library = {
      favoriteStickers: [],
      recentStickers: [],
      savedPacks: [],
    };
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ id: 'pack-1', stickers: [] })
        .mockResolvedValueOnce(library)
        .mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(gateway.getStickerPack('pack 1')).resolves.toEqual({
      id: 'pack-1',
      stickers: [],
    });
    await expect(gateway.getMyStickers(session)).resolves.toBe(library);
    await expect(
      gateway.saveStickerPack(session, 'pack-1'),
    ).resolves.toBeUndefined();
    await expect(
      gateway.unsaveStickerPack(session, 'pack-1'),
    ).resolves.toBeUndefined();
    await expect(
      gateway.favoriteSticker(session, 'pack-1', 'sticker-1'),
    ).resolves.toBeUndefined();
    await expect(
      gateway.unfavoriteSticker(session, 'pack-1', 'sticker-1'),
    ).resolves.toBeUndefined();
    await expect(
      gateway.markStickerUsed(session, 'pack-1', 'sticker-1'),
    ).resolves.toBeUndefined();

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/stickers/packs/pack%201',
      {
        method: 'GET',
      },
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      1,
      session,
      'GET',
      '/stickers/me',
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      2,
      session,
      'PUT',
      '/stickers/packs/pack-1/saved',
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      3,
      session,
      'DELETE',
      '/stickers/packs/pack-1/saved',
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      4,
      session,
      'PUT',
      '/stickers/packs/pack-1/stickers/sticker-1/favorite',
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      5,
      session,
      'DELETE',
      '/stickers/packs/pack-1/stickers/sticker-1/favorite',
    );
    expect(signer.headers).toHaveBeenNthCalledWith(
      6,
      session,
      'POST',
      '/stickers/packs/pack-1/stickers/sticker-1/used',
    );
  });

  it('uploads private attachments as signed encrypted raw bytes', async () => {
    const bytes = new Uint8Array([9, 8, 7]).buffer;
    const upload = {
      cid: 'bafy-attachment',
      contentType: 'application/octet-stream',
      encrypted: true,
      filename: 'encrypted.bin',
      size: 3,
    };
    const http = {
      request: jest.fn().mockResolvedValue(upload),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const attachment = {
      encryptedBytes: bytes,
      metadata: {
        contentType: 'image/png',
        encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
        filename: 'photo.png',
        size: 3,
      },
      uploadFilename: 'encrypted.bin',
    } satisfies PendingMessageAttachment;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.uploadPrivateFile(session, 'network-1', attachment),
    ).resolves.toBe(upload);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/network-1',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/network-1', {
      body: bytes,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': 'encrypted.bin',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('sends messages with encrypted attachment references', async () => {
    const encryptedBytes = new Uint8Array([9, 8, 7]).buffer;
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          cid: 'bafy-attachment',
          contentType: 'application/octet-stream',
          encrypted: true,
          filename: 'encrypted.bin',
          size: 3,
        })
        .mockResolvedValueOnce({
          authorIdentityId: 'identity-1',
          content: 'sent',
          id: 'message-1',
          timestamp: 10,
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const attachmentCipher = {
      encrypt: jest.fn().mockResolvedValue({
        encryptedBytes,
        metadata: {
          contentType: 'image/png',
          encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
          filename: 'photo.png',
          size: 10,
        },
        uploadFilename: 'encrypted.bin',
      }),
    } as unknown as AttachmentCipher;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'message-signature',
    });
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'one-to-one:conversation': conversationKeyEntry(
            'one-to-one:conversation',
          ),
        },
        version: 1,
      },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );

    await expect(
      gateway.sendMessage(session, 'one-to-one:conversation', 'hello', {
        attachments: [file],
        attachmentUpload: { networkId: 'network-1' },
        previousMessageIds: ['previous-message'],
        replyPreview: {
          authorIdentityId: 'identity-2',
          content: 'original',
          messageId: 'message-0',
        },
        replyToMessageId: 'message-0',
      }),
    ).resolves.toMatchObject({ content: 'sent' });

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      '/ipfs/network-1',
      expect.objectContaining({
        body: encryptedBytes,
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
          'X-Filename': 'encrypted.bin',
        }),
        method: 'POST',
      }),
    );

    const [, messageRequest] = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(messageRequest.body as string) as {
      attachmentExternalIdentifiers: string[];
      createdAt: number;
      encryptedPayload: string;
      id: string;
      previousMessageIds: string[];
      replyToMessageId?: string;
      signature: string;
    };
    const path = '/conversations/one-to-one%3Aconversation/messages';
    const [signaturePayload] = sign.mock.calls[0] as [string];
    const parsedSignaturePayload = JSON.parse(signaturePayload) as Record<
      string,
      unknown
    >;

    expect(body.attachmentExternalIdentifiers).toEqual(['bafy-attachment']);
    expect(body.createdAt).toEqual(expect.any(Number));
    expect(body.encryptedPayload).toEqual(expect.any(String));
    expect(body.id).toEqual(expect.stringContaining('one-to-one:conversation'));
    expect(body.previousMessageIds).toEqual(['previous-message']);
    expect(body.replyToMessageId).toBe('message-0');
    expect(body.signature).toBe('message-signature');
    expect(Object.keys(parsedSignaturePayload)).toEqual([
      'attachmentExternalIdentifiers',
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'replyToMessageId',
      'type',
    ]);
    expect(parsedSignaturePayload).toEqual({
      attachmentExternalIdentifiers: ['bafy-attachment'],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: body.createdAt,
      encryptedPayload: body.encryptedPayload,
      id: body.id,
      previousMessageIds: ['previous-message'],
      replyToMessageId: 'message-0',
      type: 'sent',
    });
    expect(parsedSignaturePayload).not.toHaveProperty('targetMessageId');
    expect(signer.headers).toHaveBeenLastCalledWith(
      session,
      'POST',
      path,
      body,
    );
    expect(http.request).toHaveBeenLastCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
    expect(decryptFixturePayload(body.encryptedPayload)).toMatchObject({
      attachments: [
        {
          cid: 'bafy-attachment',
          contentType: 'image/png',
          encryptedSize: 3,
          filename: 'photo.png',
          size: 10,
        },
      ],
      content: 'hello',
      reply: {
        authorIdentityId: 'identity-2',
        content: 'original',
        messageId: 'message-0',
      },
    });
  });

  it('sends stickers as encrypted message payloads without content', async () => {
    const sticker = {
      assetCid: 'bafy-sticker',
      packId: 'pack-1',
      stickerId: 'sticker-1',
    };
    const http = {
      request: jest.fn().mockResolvedValueOnce({
        authorIdentityId: 'identity-1',
        content: '',
        id: 'message-1',
        timestamp: 10,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'message-signature',
    });
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          conversation: conversationKeyEntry('conversation'),
        },
        version: 1,
      },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.sendMessage(session, 'conversation', '', { sticker }),
    ).resolves.toMatchObject({
      content: '',
    });

    const [, messageRequest] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(messageRequest.body as string) as {
      attachmentExternalIdentifiers: string[];
      encryptedPayload: string;
    };

    expect(body.attachmentExternalIdentifiers).toEqual([]);
    expect(decryptFixturePayload(body.encryptedPayload)).toMatchObject({
      content: '',
      sticker,
      type: 'StickerMessageSent',
    });
  });

  it('edits messages with a signed edit event body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue({
        authorIdentityId: 'identity-1',
        content: 'edited',
        id: 'edit-message-1',
        targetMessageId: 'message/to-edit',
        timestamp: 20,
        type: 'edited',
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'edit-signature',
    });
    const session = {
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'one-to-one:conversation': conversationKeyEntry(
            'one-to-one:conversation',
          ),
        },
        version: 1,
      },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.editMessage(
        session,
        'one-to-one:conversation',
        'message/to-edit',
        'edited',
      ),
    ).resolves.toMatchObject({
      content: 'edited',
      raw: { targetMessageId: 'message/to-edit', type: 'edited' },
    });

    const path =
      '/conversations/one-to-one%3Aconversation/messages/message%2Fto-edit';
    const [, request] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(request.body as string) as {
      createdAt: number;
      encryptedPayload: string;
      id: string;
      previousMessageIds: string[];
      signature: string;
    };
    const [signaturePayload] = sign.mock.calls[0] as [string];
    const parsedSignaturePayload = JSON.parse(signaturePayload) as Record<
      string,
      unknown
    >;

    expect(Object.keys(body)).toEqual([
      'id',
      'createdAt',
      'encryptedPayload',
      'previousMessageIds',
      'signature',
    ]);
    expect(body.id).toEqual(expect.stringMatching(/:edited$/));
    expect(body.createdAt).toEqual(expect.any(Number));
    expect(body.encryptedPayload).toEqual(expect.any(String));
    expect(body.previousMessageIds).toEqual(['message/to-edit']);
    expect(body.signature).toBe('edit-signature');
    expect(Object.keys(parsedSignaturePayload)).toEqual([
      'attachmentExternalIdentifiers',
      'authorId',
      'conversationId',
      'createdAt',
      'encryptedPayload',
      'id',
      'previousMessageIds',
      'targetMessageId',
      'type',
    ]);
    expect(parsedSignaturePayload).toEqual({
      attachmentExternalIdentifiers: [],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: body.createdAt,
      encryptedPayload: body.encryptedPayload,
      id: body.id,
      previousMessageIds: ['message/to-edit'],
      targetMessageId: 'message/to-edit',
      type: 'edited',
    });
    expect(decryptFixturePayload(body.encryptedPayload)).toMatchObject({
      attachments: [],
      content: 'edited',
      type: 'MessageEdited',
    });
    expect(signer.headers).toHaveBeenCalledWith(session, 'PUT', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'PUT',
    });
  });

  it('deletes messages with a signed tombstone body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'delete-signature',
    });
    const session = {
      identity: { id: 'identity-1' },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.deleteMessage(
        session,
        'one-to-one:conversation',
        'message/to-delete',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/conversations/one-to-one%3Aconversation/messages/message%2Fto-delete';
    const [, request] = (http.request as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(request.body as string) as {
      createdAt: number;
      id: string;
      signature: string;
    };
    const [signaturePayload] = sign.mock.calls[0] as [string, string];

    expect(http.request).toHaveBeenCalledWith(path, {
      body: expect.any(String),
      headers: { 'X-Signature': 'http-signature' },
      method: 'DELETE',
    });
    expect(signer.headers).toHaveBeenCalledWith(session, 'DELETE', path, body);
    expect(body.signature).toBe('delete-signature');
    expect(JSON.parse(signaturePayload)).toEqual({
      attachmentExternalIdentifiers: [],
      authorId: 'identity-1',
      conversationId: 'one-to-one:conversation',
      createdAt: body.createdAt,
      id: body.id,
      previousMessageIds: ['message/to-delete'],
      targetMessageId: 'message/to-delete',
      type: 'deleted',
    });
  });

  it('adds message reactions with a signed body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.addMessageReaction(
        session,
        'one-to-one:conversation',
        'message/to-react',
        '👍',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/conversations/one-to-one%3Aconversation/messages/message%2Fto-react/reactions';
    const body = { emoji: '👍' };

    expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('removes message reactions with a signed body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.removeMessageReaction(
        session,
        'one-to-one:conversation',
        'message/to-react',
        '👍',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/conversations/one-to-one%3Aconversation/messages/message%2Fto-react/reactions';
    const body = { emoji: '👍' };

    expect(signer.headers).toHaveBeenCalledWith(session, 'DELETE', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'DELETE',
    });
  });

  it('adds community channel message reactions with a signed body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.addCommunityChannelMessageReaction(
        session,
        'community/1',
        'channel/1',
        'message/to-react',
        '👍',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/communities/community%2F1/channels/channel%2F1/messages/message%2Fto-react/reactions';
    const body = { emoji: '👍' };

    expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
    });
  });

  it('removes community channel message reactions with a signed body', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const session = { identity: { id: 'identity-1' } } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);

    await expect(
      gateway.removeCommunityChannelMessageReaction(
        session,
        'community/1',
        'channel/1',
        'message/to-react',
        '👍',
      ),
    ).resolves.toBeUndefined();

    const path =
      '/communities/community%2F1/channels/channel%2F1/messages/message%2Fto-react/reactions';
    const body = { emoji: '👍' };

    expect(signer.headers).toHaveBeenCalledWith(session, 'DELETE', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'DELETE',
    });
  });

  it('loads public IPFS content by encoded cid', async () => {
    const blob = new Blob(['abc'], { type: 'image/png' });
    const content = {
      blob,
      cid: 'bafy/avatar',
      contentType: 'image/png',
      filename: 'bafy/avatar',
      size: 3,
    };
    const http = {
      requestBlob: jest.fn().mockResolvedValue(blob),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);

    await expect(gateway.getPublicFile('bafy/avatar')).resolves.toEqual(
      content,
    );

    expect(http.requestBlob).toHaveBeenCalledWith('/ipfs/bafy%2Favatar', {});
  });

  it('loads legacy public IPFS JSON content as a blob', async () => {
    const http = {
      requestBlob: jest.fn().mockResolvedValue(
        new Blob(
          [
            JSON.stringify({
              cid: 'bafy-avatar',
              contentType: 'image/png',
              data: 'AQID',
              filename: 'avatar.png',
              size: 3,
            }),
          ],
          { type: 'application/json' },
        ),
      ),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(http);

    const content = await gateway.getPublicFile('bafy-avatar');

    expect(content).toMatchObject({
      cid: 'bafy-avatar',
      contentType: 'image/png',
      filename: 'avatar.png',
      size: 3,
    });
    await expect(content.blob.arrayBuffer()).resolves.toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
    expect(content.blob.type).toBe('image/png');
  });

  it('downloads encrypted private attachment content', async () => {
    const encryptedBytes = new Uint8Array([1, 2, 3]);
    const decrypted = new Blob(['clear'], { type: 'image/png' });
    const http = {
      request: jest.fn().mockResolvedValue({
        cid: 'bafy/attachment',
        contentType: 'application/octet-stream',
        encrypted: true,
        encryptedData: 'AQID',
        filename: 'encrypted.bin',
        size: 3,
      }),
    } as unknown as HttpJsonClient;
    const attachmentCipher = {
      base64ToBytes: jest.fn().mockReturnValue(encryptedBytes),
      bytesToArrayBuffer: jest.fn().mockReturnValue(encryptedBytes.buffer),
      decrypt: jest.fn().mockResolvedValue(decrypted),
    } as unknown as AttachmentCipher;
    const gateway = new PigeonApiGateway(
      http,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );
    const attachment = {
      cid: 'bafy/attachment',
      contentType: 'image/png',
      encryption: { algorithm: 'AES-GCM', iv: 'iv', key: 'key' },
      filename: 'photo.png',
      size: 3,
    } as const;

    await expect(gateway.downloadAttachment(attachment)).resolves.toBe(
      decrypted,
    );

    expect(http.request).toHaveBeenCalledWith('/ipfs/bafy%2Fattachment');
    expect(attachmentCipher.base64ToBytes).toHaveBeenCalledWith('AQID');
    expect(attachmentCipher.decrypt).toHaveBeenCalledWith(
      attachment,
      encryptedBytes.buffer,
      undefined,
    );
  });

  it('uploads large unencrypted attachments as public chunks', async () => {
    const chunkBytes = new Uint8Array([1, 2, 3]).buffer;
    let uploadIndex = 0;
    const http = {
      request: jest.fn().mockImplementation(() => {
        uploadIndex += 1;

        return Promise.resolve({ cid: `public-chunk-${uploadIndex}`, size: 3 });
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'http-signature' }),
    } as unknown as RequestSigner;
    const attachmentCipher = {
      encrypt: jest.fn(),
    } as unknown as AttachmentCipher;
    const largeFile = {
      name: 'large.mov',
      size: 51 * 1024 * 1024,
      slice: jest.fn().mockReturnValue({
        arrayBuffer: jest.fn().mockResolvedValue(chunkBytes),
      }),
      type: 'video/quicktime',
    } as unknown as File;
    const session = {
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(
      http,
      signer,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );

    const attachments = await gateway.publishMessageAttachments(
      session,
      [largeFile],
      undefined,
      { encryptLargeAttachments: false },
    );

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      cid: 'public-chunk-1',
      contentType: 'video/quicktime',
      encrypted: false,
      filename: 'large.mov',
      size: 51 * 1024 * 1024,
      storage: 'public',
      type: 'chunked_file',
    });
    expect(attachments[0].chunks).toHaveLength(7);
    expect(attachments[0].chunks?.[0]).toMatchObject({
      cid: 'public-chunk-1',
      index: 0,
      size: 3,
    });
    expect(attachmentCipher.encrypt).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledTimes(7);
    expect(http.request).toHaveBeenNthCalledWith(1, '/ipfs/public', {
      body: chunkBytes,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': 'large.mov.part-0000',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
  });

  it('downloads public chunked attachments without decrypting', async () => {
    const http = {
      requestBlob: jest
        .fn()
        .mockResolvedValueOnce(new Blob(['hello ']))
        .mockResolvedValueOnce(new Blob(['world'])),
    } as unknown as HttpJsonClient;
    const attachmentCipher = {
      decrypt: jest.fn(),
    } as unknown as AttachmentCipher;
    const gateway = new PigeonApiGateway(
      http,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      attachmentCipher,
    );

    const blob = await gateway.downloadAttachment({
      chunks: [
        { cid: 'chunk-2', index: 1, sha256: 'two', size: 5 },
        { cid: 'chunk-1', index: 0, sha256: 'one', size: 6 },
      ],
      cid: 'chunk-1',
      contentType: 'text/plain',
      encrypted: false,
      filename: 'note.txt',
      size: 11,
      storage: 'public',
      type: 'chunked_file',
    });

    await expect(blob.text()).resolves.toBe('hello world');
    expect(blob.type).toBe('text/plain');
    expect(attachmentCipher.decrypt).not.toHaveBeenCalled();
    expect(http.requestBlob).toHaveBeenNthCalledWith(
      1,
      '/ipfs/chunk-1',
      expect.objectContaining({ onDownloadProgress: expect.any(Function) }),
    );
    expect(http.requestBlob).toHaveBeenNthCalledWith(
      2,
      '/ipfs/chunk-2',
      expect.objectContaining({ onDownloadProgress: expect.any(Function) }),
    );
  });

  it('does not reuse cached public chunked blobs when later chunks differ', async () => {
    const http = {
      requestBlob: jest
        .fn()
        .mockResolvedValueOnce(new Blob(['hello ']))
        .mockResolvedValueOnce(new Blob(['world']))
        .mockResolvedValueOnce(new Blob(['hello ']))
        .mockResolvedValueOnce(new Blob(['moon'])),
    } as unknown as HttpJsonClient;
    const gateway = new PigeonApiGateway(
      http,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const baseAttachment = {
      cid: 'chunk-1',
      contentType: 'text/plain',
      encrypted: false,
      filename: 'note.txt',
      size: 11,
      storage: 'public',
      type: 'chunked_file',
    } as const;

    const firstBlob = await gateway.downloadAttachment({
      ...baseAttachment,
      chunks: [
        { cid: 'chunk-1', index: 0, sha256: 'one', size: 6 },
        { cid: 'chunk-2', index: 1, sha256: 'two', size: 5 },
      ],
    });
    const secondBlob = await gateway.downloadAttachment({
      ...baseAttachment,
      chunks: [
        { cid: 'chunk-1', index: 0, sha256: 'one', size: 6 },
        { cid: 'chunk-3', index: 1, sha256: 'three', size: 5 },
      ],
    });

    await expect(firstBlob.text()).resolves.toBe('hello world');
    await expect(secondBlob.text()).resolves.toBe('hello moon');
    expect(http.requestBlob).toHaveBeenCalledTimes(4);
    expect(http.requestBlob).toHaveBeenNthCalledWith(
      4,
      '/ipfs/chunk-3',
      expect.objectContaining({ onDownloadProgress: expect.any(Function) }),
    );
  });
});
