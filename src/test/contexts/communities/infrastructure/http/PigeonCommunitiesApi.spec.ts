import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { DraftPayloadCipher } from '../../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCommunitiesApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunitiesApi';

type SentBody = {
  createdAt?: number;
  emoji?: string;
  mutation: Record<string, unknown>;
};

describe(PigeonCommunitiesApi.name, () => {
  it('uses the backend cursor when listing community channel messages', async () => {
    const messages = [
      { id: 'message-2', type: 'sent' },
      { id: 'poll-1', pollId: 'poll-1', type: 'poll' },
    ];
    const http = {
      request: jest.fn().mockResolvedValue({
        messages,
        nextBeforeMessageId: 'backend-cursor',
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.listChannelMessages(session, 'community-1', 'channel-1'),
    ).resolves.toEqual({
      messages,
      nextBeforeMessageId: 'backend-cursor',
    });
  });

  it('returns the pagination cursor sent by the node', async () => {
    const messages = [
      { id: 'message-2', type: 'sent' },
      { id: 'poll-1', pollId: 'poll-1', type: 'poll' },
    ];
    const http = {
      request: jest
        .fn()
        .mockResolvedValue({ messages, nextBeforeMessageId: 'message-2' }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.listChannelMessages(session, 'community-1', 'channel-1', {
        limit: 2,
      }),
    ).resolves.toEqual({
      messages,
      nextBeforeMessageId: 'message-2',
    });
  });

  it('has no cursor when the node sends none', async () => {
    const messages = [{ id: 'message-1', type: 'sent' }];
    const http = {
      request: jest.fn().mockResolvedValue({ messages }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.listChannelMessages(session, 'community-1', 'channel-1', {
        limit: 2,
      }),
    ).resolves.toEqual({
      messages,
      nextBeforeMessageId: null,
    });
  });

  describe('channel message mutations', () => {
    const path = '/communities/community-1/channels/channel-1/messages';
    const recordId = 'community:community-1:channel-1:message-1:identity-1';

    async function setup() {
      const device = await KeyPair.generate();
      const http = {
        request: jest.fn().mockResolvedValue({ id: 'message-1' }),
      } as unknown as HttpJsonClient;
      const signer = {
        headers: jest.fn().mockResolvedValue({}),
      } as unknown as RequestSigner;
      const session = {
        deviceCredentialKeyPair: device,
        identity: { id: 'identity-1' },
      } as unknown as Session;
      const api = new PigeonCommunitiesApi(
        http,
        signer,
        async (_key, loader) => await loader(),
      );
      const sent = () =>
        JSON.parse(
          (
            (http.request as jest.Mock).mock.calls[0] as [
              string,
              { body: string },
            ]
          )[1].body,
        ) as Record<string, unknown>;

      return { api, http, sent, session, signer };
    }

    it('signs a sent message as a put of its author-bound record', async () => {
      const { api, sent, session, signer } = await setup();

      await api.createChannelMessage(session, 'community-1', 'channel-1', {
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        replyToMessageId: 'root-message',
        timestamp: 1779315464545,
      });

      const body = sent();

      expect(body).toMatchObject({
        createdAt: 1779315464545,
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        mentions: [],
        replyToMessageId: 'root-message',
      });
      expect(body.signature).toBeUndefined();
      expect(body.mutation).toMatchObject({
        kind: 'put',
        predecessor: null,
        recordId,
        sequence: 0,
        store: 'messages',
      });
      expect(signer.headers).toHaveBeenCalledWith(session, 'POST', path, body);
    });

    it('signs public messages with plaintext payloads', async () => {
      const { api, sent, session } = await setup();

      await api.createChannelMessage(session, 'community-1', 'channel-1', {
        id: 'message-1',
        plaintextPayload: '{"content":"hello"}',
        timestamp: 1779315464545,
      });

      expect(sent()).toMatchObject({
        plaintextPayload: '{"content":"hello"}',
      });
      expect(sent().mutation).toMatchObject({ recordId, store: 'messages' });
    });

    it('signs an edit against the same record as the original message', async () => {
      const { api, sent, session, signer } = await setup();

      await api.editChannelMessage(
        session,
        'community-1',
        'channel-1',
        'message-1',
        {
          encryptedPayload: 'edited-payload',
          original: { createdAt: 1773848800000 },
          timestamp: 1773848929055,
        },
      );

      const body = sent();

      expect(body).toMatchObject({
        createdAt: 1773848929055,
        encryptedPayload: 'edited-payload',
        mentions: [],
      });
      expect(body.mutation).toMatchObject({
        kind: 'put',
        recordId,
        store: 'messages',
      });
      expect(signer.headers).toHaveBeenCalledWith(
        session,
        'PUT',
        `${path}/message-1`,
        body,
      );
    });

    it('signs a delete as a tombstone of the original author record', async () => {
      const { api, sent, session } = await setup();

      await api.deleteChannelMessage(
        session,
        'community-1',
        'channel-1',
        'message-1',
        'author-2',
      );

      expect(Object.keys(sent()).sort()).toEqual(['moderationLog', 'mutation']);
      expect(sent().moderationLog).toMatchObject({
        mutation: { sequence: 0, store: 'moderationLogs' },
      });
      expect(sent().mutation).toMatchObject({
        kind: 'delete',
        recordId: 'community:community-1:channel-1:message-1:author-2',
        store: 'messages',
      });
    });
  });

  it('signs public channel message search without query parameters', async () => {
    const response = {
      channelId: 'channel-1',
      communityId: 'community-1',
      messages: [],
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
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.searchChannelMessages(session, 'community-1', 'channel-1', {
        limit: 20,
        query: 'hello there',
      }),
    ).resolves.toEqual(response);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/communities/community-1/channels/channel-1/messages/search',
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages/search?limit=20&query=hello+there',
      {
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'GET',
      },
    );
  });

  it('signs public community message search without query parameters', async () => {
    const response = {
      communityId: 'community-1',
      messages: [],
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
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.searchCommunityMessages(session, 'community-1', {
        limit: 20,
        query: 'hello there',
      }),
    ).resolves.toEqual(response);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/communities/community-1/messages/search',
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/messages/search?limit=20&query=hello+there',
      {
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'GET',
      },
    );
  });

  it('loads community channel message threads without signing query parameters', async () => {
    const response = {
      channelId: 'channel-1',
      communityId: 'community-1',
      messages: [{ id: 'reply-1', replyToMessageId: 'message-1' }],
      nextBeforeMessageId: 'reply-1',
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
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await expect(
      api.listChannelMessageThread(
        session,
        'community-1',
        'channel-1',
        'message-1',
      ),
    ).resolves.toEqual({
      messages: response.messages,
      nextBeforeMessageId: 'reply-1',
    });

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/communities/community-1/channels/channel-1/messages/message-1/thread',
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages/message-1/thread?limit=50',
      {
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'GET',
      },
    );
  });

  it('pins and unpins community channel messages with signed mutations', async () => {
    const device = await KeyPair.generate();
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    const path =
      '/communities/community-1/channels/channel-1/messages/message-1/pin';

    await api.pinChannelMessage(
      session,
      'community-1',
      'channel-1',
      'message-1',
    );
    await api.unpinChannelMessage(
      session,
      'community-1',
      'channel-1',
      'message-1',
    );

    const [pin, unpin] = (http.request as jest.Mock).mock.calls.map(
      ([, init]: [string, { body: string }]) =>
        JSON.parse(init.body) as SentBody,
    );

    expect(http.request).toHaveBeenNthCalledWith(
      1,
      path,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(http.request).toHaveBeenNthCalledWith(
      2,
      path,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(pin.createdAt).toEqual(expect.any(Number));
    expect(pin.mutation).toMatchObject({
      kind: 'put',
      predecessor: null,
      recordId: 'community:community-1:channel-1:message-1',
      sequence: 0,
      store: 'pins',
      version: 1,
    });
    expect(unpin.mutation).toMatchObject({ kind: 'delete', store: 'pins' });
    expect(unpin.createdAt).toBeUndefined();
    expect(signer.headers).toHaveBeenNthCalledWith(
      1,
      session,
      'POST',
      path,
      pin,
    );
  });

  it('signs reaction mutations bound to author and emoji', async () => {
    const device = await KeyPair.generate();
    const http = {
      request: jest.fn().mockResolvedValue(undefined),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({}),
    } as unknown as RequestSigner;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );

    await api.addChannelMessageReaction(session, 'c', 'ch', 'm', '👍');
    await api.removeChannelMessageReaction(session, 'c', 'ch', 'm', '👍');

    const [added, removed] = (http.request as jest.Mock).mock.calls.map(
      ([, init]: [string, { body: string }]) =>
        JSON.parse(init.body) as SentBody,
    );

    expect(added.emoji).toBe('👍');
    expect(added.mutation).toMatchObject({
      kind: 'put',
      recordId: 'community_channel:c:ch:m:identity-1:👍',
      store: 'reactions',
    });
    expect(removed.mutation).toMatchObject({ kind: 'delete' });
    expect(removed.createdAt).toBeUndefined();
  });

  it('chains the auto-join acceptance proof after the join request', async () => {
    const device = await KeyPair.generate();
    const http = {
      request: jest.fn((path: string) =>
        path.endsWith('/frontier') ? { frontier: [] } : {},
      ),
    } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      async (_key, loader) => await loader(),
    );

    await api.createJoinRequest(session, 'community-1', 'network-1');

    const body = JSON.parse(
      (
        (http.request as jest.Mock).mock.calls[1] as [string, { body: string }]
      )[1].body,
    ) as {
      acceptedAt: number;
      acceptedMutation: Record<string, unknown>;
      createdAt: number;
      mutation: Record<string, unknown>;
      operation: {
        createdAt: number;
        parents: string[];
        mutation: Record<string, unknown>;
      };
    };

    expect(body.operation).toMatchObject({
      createdAt: body.acceptedAt,
      mutation: {
        recordId: expect.stringMatching(
          /^community:community-1:op:[A-Za-z0-9_-]{43}$/,
        ),
        sequence: 0,
        store: 'communityOperations',
      },
      parents: [],
    });

    expect(body.acceptedAt).toBeGreaterThan(body.createdAt);
    expect(body.mutation).toMatchObject({ predecessor: null, sequence: 0 });
    expect(body.acceptedMutation).toMatchObject({
      predecessor: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      recordId: body.mutation.recordId,
      sequence: 1,
      store: 'requests',
    });
  });

  it('signs membership invitations and resolutions as request records', async () => {
    const device = await KeyPair.generate();
    const request = {
      communityId: 'community-1',
      createdAt: 10,
      creatorIdentityId: 'identity-2',
      id: 'a'.repeat(24),
      identityId: 'identity-1',
      status: 'pending',
      type: 'invitation',
      updatedAt: 10,
    };
    const http = {
      request: jest.fn((path: string) => {
        if (path.endsWith('/frontier')) return { frontier: [] };

        if (path === '/communities/community-1')
          return { networkId: 'network-1' };

        if (path === '/communities/membership-requests') {
          return { requests: [request] };
        }

        return {};
      }),
    } as unknown as HttpJsonClient;
    const session = {
      deviceCredentialKeyPair: device,
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      async (_key, loader) => await loader(),
    );

    await api.updateMembershipRequest(session, request.id, 'accepted');
    await api.inviteMember(session, 'community-1', 'identity-3');

    const [patch, invite] = (http.request as jest.Mock).mock.calls
      .filter(([path]: [string]) => !path.endsWith('/frontier'))
      .filter(
        ([path]: [string]) =>
          path !== '/communities/membership-requests' &&
          path !== '/communities/community-1',
      )
      .map(
        ([, init]: [string, { body: string }]) =>
          JSON.parse(init.body) as Record<string, unknown>,
      );

    expect(patch).toMatchObject({
      mutation: { recordId: request.id, store: 'requests' },
      status: 'accepted',
      updatedAt: expect.any(Number),
    });
    expect(invite).toMatchObject({
      identityId: 'identity-3',
      mutation: {
        recordId: expect.stringMatching(/^[0-9a-f]{24}$/),
        sequence: 0,
      },
    });
  });

  it('stores community channel drafts as encrypted local payloads', async () => {
    const response = {
      channelId: 'channel-1',
      communityId: 'community-1',
      encryptedPayload: 'encrypted-draft',
      updatedAt: 1770000000000,
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
    const draftPayloads = {
      encrypt: jest.fn().mockReturnValue('encrypted-draft'),
    } as unknown as DraftPayloadCipher;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
      draftPayloads,
    );
    const body = {
      encryptedPayload: 'encrypted-draft',
      updatedAt: 1770000000000,
    };

    await expect(
      api.saveChannelDraft(
        session,
        'community-1',
        'channel-1',
        'hello',
        1770000000000,
      ),
    ).resolves.toEqual({ ...response, content: 'hello' });

    expect(draftPayloads.encrypt).toHaveBeenCalledWith(session, 'hello');
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/communities/community-1/channels/channel-1/draft',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/draft',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'PUT',
      },
    );
  });

  it('invalidates the community detail cache after assigning member roles', async () => {
    const community = { id: 'community-1' };
    const http = {
      request: jest.fn((path: string) =>
        path.endsWith('/frontier') ? { frontier: [] } : community,
      ),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const invalidateCachedRequest = jest.fn();
    const session = {
      deviceCredentialKeyPair: await KeyPair.generate(),
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
      undefined,
      invalidateCachedRequest,
    );

    await expect(
      api.assignMemberRoles(session, 'community-1', 'member-1', ['role-1']),
    ).resolves.toBe(community);

    expect(invalidateCachedRequest).toHaveBeenCalledWith(
      'GET /communities/community-1 identity-1',
    );
  });

  describe('moderation logs', () => {
    async function setup(response: unknown = {}) {
      const http = {
        request: jest.fn((path: string, init?: { method?: string }) => {
          if (path.endsWith('/frontier')) return { frontier: ['b'.repeat(43)] };

          if (path === '/communities/community-1' && init?.method === 'GET') {
            return {
              description: 'About',
              name: 'Community',
              networkId: 'network-1',
            };
          }

          return response;
        }),
      } as unknown as HttpJsonClient;
      const session = {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identity: { id: 'identity-1' },
      } as unknown as Session;
      const api = new PigeonCommunitiesApi(
        http,
        {
          headers: jest.fn().mockResolvedValue({}),
        } as unknown as RequestSigner,
        async (_key, loader) => await loader(),
      );
      const lastBody = () => {
        const calls = (http.request as jest.Mock).mock.calls as [
          string,
          { body: string },
        ][];

        return JSON.parse(calls[calls.length - 1][1].body) as {
          operation: {
            createdAt: number;
            parents: string[];
            mutation: Record<string, unknown>;
          };
          moderationLog: {
            createdAt: number;
            mutation: Record<string, unknown>;
          };
        };
      };

      return { api, http, lastBody, session };
    }

    it('signs a log for every moderation route with a bodyless-DELETE body', async () => {
      const { api, http, lastBody, session } = await setup({
        channels: [{ id: 'channel-1', type: 'voice' }],
      });

      await api.updateRole(session, 'community-1', 'role-1', {
        name: 'Mod',
        permissions: [],
      });
      expect(lastBody().moderationLog.mutation).toMatchObject({
        kind: 'put',
        predecessor: null,
        sequence: 0,
        store: 'moderationLogs',
      });
      await api.deleteRole(session, 'community-1', 'role-1');
      expect(lastBody().moderationLog.mutation.store).toBe('moderationLogs');
      await api.unbanMember(session, 'community-1', 'member-1');
      expect(lastBody().moderationLog.mutation.store).toBe('moderationLogs');
      await api.banMember(session, 'community-1', 'member-1');
      expect(lastBody()).toMatchObject({ identityId: 'member-1' });
      await api.update(session, 'community-1', { name: 'New' });
      expect(lastBody()).toMatchObject({ name: 'New' });
      await api.renameChannel(session, 'community-1', 'channel-1', 'x');
      await api.updateChannelPermissions(session, 'community-1', 'channel-1', [
        'role-1',
      ]);
      await api.deleteChannel(session, 'community-1', 'channel-1');
      expect(lastBody().moderationLog.mutation.store).toBe('moderationLogs');
      expect(
        (http.request as jest.Mock).mock.calls.filter(
          ([, init]: [string, { method?: string; body?: string }]) =>
            init?.method === 'DELETE' && !init.body,
        ),
      ).toHaveLength(0);
    });

    it('signs a community operation on the frontier for every mutation route', async () => {
      const { api, lastBody, session } = await setup({
        channels: [{ id: 'channel-1', type: 'text' }],
      });
      const parent = 'b'.repeat(43);

      await api.banMember(session, 'community-1', 'member-1');
      expect(lastBody().operation).toMatchObject({
        mutation: {
          kind: 'put',
          predecessor: null,
          sequence: 0,
          store: 'communityOperations',
        },
        parents: [parent],
      });
      await api.kickMember(session, 'community-1', 'member-1');
      expect(Object.keys(lastBody())).toEqual(['operation']);
      await api.leave(session, 'community-1');
      expect(Object.keys(lastBody())).toEqual(['operation']);
      await api.deleteChannel(session, 'community-1', 'channel-1');
      await api.createVoiceChannel(session, 'community-1', 'voice');
      await api.deleteRole(session, 'community-1', 'role-1');
      await api.assignMemberRoles(session, 'community-1', 'member-1', ['r']);
      await api.update(session, 'community-1', { name: 'New' });
      expect(lastBody().operation.mutation.store).toBe('communityOperations');
    });

    it('derives the log id and the created entity id from the same createdAt', async () => {
      const { api, lastBody, session } = await setup({});

      await api.createRole(session, 'community-1', {
        name: 'Mod',
        permissions: [],
      });
      const first = lastBody().moderationLog;

      await api.createTextChannel(session, 'community-1', 'general');
      const second = lastBody().moderationLog;

      expect(first.mutation.recordId).toMatch(/^[0-9a-f]{24}$/);
      expect(second.mutation.recordId).toMatch(/^[0-9a-f]{24}$/);
      expect(first.mutation.recordId).not.toBe(second.mutation.recordId);
    });
  });
});
