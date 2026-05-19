import { KeyPair } from '@haskou/value-objects';

import type {
  IdentityResource,
  LocalKeychain,
  PendingMessageAttachment,
  Session,
} from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

import { AttachmentCipher } from '../../domain/attachments/AttachmentCipher';
import { PigeonApiGateway } from './PigeonApiGateway';

describe(PigeonApiGateway.name, () => {
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

  it('creates communities with signed metadata payload', async () => {
    const community = {
      avatar: 'bafy-avatar',
      banner: 'bafy-banner',
      createdAt: 1,
      description: 'Description',
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
        avatar: 'bafy-avatar',
        banner: 'bafy-banner',
        description: 'Description',
        name: 'Mi comunidad',
        networkId: 'network-1',
      }),
    ).resolves.toBe(community);

    const body = {
      avatar: 'bafy-avatar',
      banner: 'bafy-banner',
      description: 'Description',
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
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({
          toString: () => 'domain-signature',
        }),
      },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const gateway = new PigeonApiGateway(http, signer);
    const path = '/communities/community-1/channels/channel-1/messages';
    const body = {
      attachmentExternalIdentifiers: ['bafy-private'],
      createdAt: 1234,
      encryptedPayload: 'encrypted-payload',
      id: 'message-1',
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
    expect(session.encryptedKeyPair.sign).toHaveBeenCalledWith(
      JSON.stringify({
        attachmentExternalIdentifiers: ['bafy-private'],
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1234,
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        type: 'sent',
      }),
      'secret',
    );
    expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    expect(http.request).toHaveBeenCalledWith(path, {
      body: JSON.stringify(body),
      headers: { 'X-Signature': 'http-signature' },
      method: 'POST',
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
      encryptedKeyPair: {
        sign: jest
          .fn()
          .mockResolvedValue({ toString: () => 'inviter-signature' }),
      },
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 0 },
      keychainExternalIdentifier: 'keychain-current',
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

  it('accepts group invitations by publishing the decrypted keychain entry', async () => {
    const keyEntry = {
      conversationId: 'group:conversation',
      createdAt: 1,
      peerIdentityId: 'identity-2',
      privateKey: 'private-key',
      publicKey: 'public-key',
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
      encryptedKeyPair: {
        decrypt: jest.fn().mockResolvedValue({
          toString: () => JSON.stringify(keyEntry),
        }),
      },
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

  it('publishes the community invite link key before accepting the invite', async () => {
    const keyEntry = {
      conversationId: 'community-1',
      createdAt: 1,
      peerIdentityId: '',
      privateKey: 'private-key',
      publicKey: 'public-key',
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
      id: 'public-key',
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
      'id',
      'networks',
      'profile',
      'timestamp',
      'version',
      'signature',
    ]);
    expect(body).toEqual({
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      id: 'public-key',
      networks: ['network-1'],
      profile: {
        handle: 'ada',
        name: 'Ada',
      },
      signature: 'keypair-signature',
      timestamp: 1234,
      version: 1,
    });
    const signingBody = (signer.headers as jest.Mock).mock.calls[0][3] as
      | IdentityResource
      | undefined;

    expect(Object.keys(signingBody ?? {})).toEqual([
      'encryptedKeyPair',
      'id',
      'networks',
      'previousIdentityExternalIdentifier',
      'profile',
      'timestamp',
      'version',
      'signature',
    ]);
    expect(signingBody?.previousIdentityExternalIdentifier).toBeUndefined();
    expect(signer.headers).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ id: 'public-key' }),
        password: 'secret',
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

  it('refreshes the current identity reference before signing profile updates', async () => {
    const currentIdentity = {
      encryptedKeyPair: {
        encryptedPrivateKey: 'encrypted-private-key',
        publicKey: 'public-key',
      },
      id: 'identity/with+symbols=',
      identityExternalIdentifier: 'current-identity-cid',
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
      encryptedKeyPair: {
        sign: jest.fn().mockResolvedValue({
          toString: () => 'identity-signature',
        }),
      },
      identity: {
        ...currentIdentity,
        identityExternalIdentifier: undefined,
        previousIdentityExternalIdentifier: undefined,
        version: 1,
      },
      keychain: { conversations: {}, version: 0 },
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
      'id',
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
    const [signedPayload, signedPassword] = (
      session.encryptedKeyPair.sign as jest.Mock
    ).mock.calls[0] as [string, string];
    const parsedSignedPayload = JSON.parse(
      signedPayload,
    ) as Partial<IdentityResource>;

    expect(parsedSignedPayload).toEqual({
      encryptedKeyPair: currentIdentity.encryptedKeyPair,
      id: currentIdentity.id,
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
    expect(signedPassword).toBe(session.password);
  });

  it('uploads public profile files as signed binary bodies', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const upload = {
      cid: 'bafy-avatar',
      contentType: 'image/png',
      filename: 'avatar.png',
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
      name: 'avatar.png',
      type: 'image/png',
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
        'Content-Type': 'image/png',
        'X-Filename': 'avatar.png',
        'X-Signature': 'http-signature',
      },
      method: 'POST',
    });
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

    await expect(gateway.uploadPrivateFile(session, attachment)).resolves.toBe(
      upload,
    );

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/ipfs/private',
      bytes,
    );
    expect(http.request).toHaveBeenCalledWith('/ipfs/private', {
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
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      keychain: {
        conversations: {
          'one-to-one:conversation': {
            conversationId: 'one-to-one:conversation',
            createdAt: 1,
            peerIdentityId: 'identity-2',
            privateKey: 'private-key',
            publicKey: 'public-key',
          },
        },
        version: 1,
      },
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
        previousMessageIds: ['previous-message'],
        replyPreview: {
          authorIdentityId: 'identity-2',
          content: 'original',
          messageId: 'message-0',
        },
        replyToMessageId: 'message-0',
      }),
    ).resolves.toMatchObject({ content: 'sent' });

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
    const [signaturePayload, signaturePassword] = sign.mock.calls[0] as [
      string,
      string,
    ];
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
    expect(signaturePassword).toBe('secret');
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
    expect(JSON.parse(body.encryptedPayload)).toMatchObject({
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
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
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
