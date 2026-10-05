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
  function sessionWithSigner(sign: jest.Mock): Session {
    return {
      identity: { id: 'identity-1' },
      keyPair: { sign },
      password: 'secret',
    } as unknown as Session;
  }

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

  it('signs community channel messages with the backend domain payload order', async () => {
    const created = {
      channelId: '6a073dc64d72b40039b156f8',
      communityId: '6a072ee87e00690039d0ad27',
      id: 'message-1',
      type: 'sent',
    };
    const http = {
      request: jest.fn().mockResolvedValue(created),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'domain-signature',
    });
    const session = sessionWithSigner(sign);
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    const body = {
      createdAt: 1779315464545,
      encryptedPayload: 'encrypted-payload',
      id: '6a072ee87e00690039d0ad27:6a073dc64d72b40039b156f8:1779315464545:cf164426-84b5-4eda-8e58-d9ef8b198f0d',
      mentions: [],
      signature: 'domain-signature',
    };

    await expect(
      api.createChannelMessage(
        session,
        '6a072ee87e00690039d0ad27',
        '6a073dc64d72b40039b156f8',
        {
          encryptedPayload: 'encrypted-payload',
          id: '6a072ee87e00690039d0ad27:6a073dc64d72b40039b156f8:1779315464545:cf164426-84b5-4eda-8e58-d9ef8b198f0d',
          timestamp: 1779315464545,
        },
      ),
    ).resolves.toBe(created);

    expect(sign).toHaveBeenCalledWith(
      JSON.stringify({
        authorIdentityId: 'identity-1',
        channelId: '6a073dc64d72b40039b156f8',
        communityId: '6a072ee87e00690039d0ad27',
        createdAt: 1779315464545,
        encryptedPayload: 'encrypted-payload',
        id: '6a072ee87e00690039d0ad27:6a073dc64d72b40039b156f8:1779315464545:cf164426-84b5-4eda-8e58-d9ef8b198f0d',
        mentions: [],
        type: 'sent',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/communities/6a072ee87e00690039d0ad27/channels/6a073dc64d72b40039b156f8/messages',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/6a072ee87e00690039d0ad27/channels/6a073dc64d72b40039b156f8/messages',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'POST',
      },
    );
  });

  it('signs public community channel messages with plaintext payloads', async () => {
    const created = {
      channelId: 'channel-1',
      communityId: 'community-1',
      id: 'message-1',
      plaintextPayload: '{"content":"hello"}',
      type: 'sent',
    };
    const http = {
      request: jest.fn().mockResolvedValue(created),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'domain-signature',
    });
    const session = sessionWithSigner(sign);
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    const body = {
      createdAt: 1779315464545,
      id: 'message-1',
      mentions: [],
      plaintextPayload: '{"content":"hello"}',
      signature: 'domain-signature',
    };

    await expect(
      api.createChannelMessage(session, 'community-1', 'channel-1', {
        id: 'message-1',
        plaintextPayload: '{"content":"hello"}',
        timestamp: 1779315464545,
      }),
    ).resolves.toBe(created);

    expect(sign).toHaveBeenCalledWith(
      JSON.stringify({
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1779315464545,
        id: 'message-1',
        mentions: [],
        plaintextPayload: '{"content":"hello"}',
        type: 'sent',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/communities/community-1/channels/channel-1/messages',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'POST',
      },
    );
  });

  it('includes reply targets in community channel message bodies and signatures', async () => {
    const created = {
      channelId: 'channel-1',
      communityId: 'community-1',
      id: 'message-1',
      replyToMessageId: 'root-message',
      type: 'sent',
    };
    const http = {
      request: jest.fn().mockResolvedValue(created),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'domain-signature',
    });
    const session = sessionWithSigner(sign);
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    const body = {
      createdAt: 1779315464545,
      encryptedPayload: 'encrypted-payload',
      id: 'message-1',
      mentions: [],
      replyToMessageId: 'root-message',
      signature: 'domain-signature',
    };

    await expect(
      api.createChannelMessage(session, 'community-1', 'channel-1', {
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        replyToMessageId: 'root-message',
        timestamp: 1779315464545,
      }),
    ).resolves.toBe(created);

    expect(sign).toHaveBeenCalledWith(
      JSON.stringify({
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1779315464545,
        encryptedPayload: 'encrypted-payload',
        id: 'message-1',
        mentions: [],
        replyToMessageId: 'root-message',
        type: 'sent',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'POST',
      '/communities/community-1/channels/channel-1/messages',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'POST',
      },
    );
  });

  it('signs edited community channel messages with the backend domain payload order', async () => {
    const edited = {
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId: 'community-1',
      createdAt: 1773848800000,
      editedAt: 1773848929055,
      encryptedPayload: 'edited-encrypted-payload',
      id: 'message-1',
      mentions: [],
      type: 'sent',
    };
    const http = {
      request: jest.fn().mockResolvedValue(edited),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'edition-signature',
    });
    const session = sessionWithSigner(sign);
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    /* eslint-disable perfectionist/sort-objects */
    const body = {
      createdAt: 1773848929055,
      encryptedPayload: 'edited-encrypted-payload',
      signature: 'edition-signature',
      mentions: [],
    };
    /* eslint-enable perfectionist/sort-objects */

    await expect(
      api.editChannelMessage(session, 'community-1', 'channel-1', 'message-1', {
        encryptedPayload: 'edited-encrypted-payload',
        timestamp: 1773848929055,
      }),
    ).resolves.toBe(edited);

    expect(sign).toHaveBeenCalledWith(
      JSON.stringify({
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1773848929055,
        encryptedPayload: 'edited-encrypted-payload',
        id: 'message-1',
        mentions: [],
        type: 'edited',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/communities/community-1/channels/channel-1/messages/message-1',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages/message-1',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'PUT',
      },
    );
  });

  it('signs public community channel edits with plaintext payloads', async () => {
    const edited = {
      authorIdentityId: 'identity-1',
      channelId: 'channel-1',
      communityId: 'community-1',
      editedAt: 1773848929055,
      id: 'message-1',
      plaintextPayload: '{"content":"edited"}',
      type: 'sent',
    };
    const http = {
      request: jest.fn().mockResolvedValue(edited),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const sign = jest.fn().mockResolvedValue({
      toString: () => 'edition-signature',
    });
    const session = sessionWithSigner(sign);
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    /* eslint-disable perfectionist/sort-objects */
    const body = {
      createdAt: 1773848929055,
      plaintextPayload: '{"content":"edited"}',
      signature: 'edition-signature',
      mentions: [],
    };
    /* eslint-enable perfectionist/sort-objects */

    await expect(
      api.editChannelMessage(session, 'community-1', 'channel-1', 'message-1', {
        plaintextPayload: '{"content":"edited"}',
        timestamp: 1773848929055,
      }),
    ).resolves.toBe(edited);

    expect(sign).toHaveBeenCalledWith(
      JSON.stringify({
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1773848929055,
        id: 'message-1',
        mentions: [],
        plaintextPayload: '{"content":"edited"}',
        type: 'edited',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/communities/community-1/channels/channel-1/messages/message-1',
      body,
    );
    expect(http.request).toHaveBeenCalledWith(
      '/communities/community-1/channels/channel-1/messages/message-1',
      {
        body: JSON.stringify(body),
        headers: { 'X-Identity-Id': 'identity-1' },
        method: 'PUT',
      },
    );
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
      request: jest.fn().mockResolvedValue({}),
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

    await api.createJoinRequest(session, 'community-1');

    const body = JSON.parse(
      (
        (http.request as jest.Mock).mock.calls[0] as [string, { body: string }]
      )[1].body,
    ) as {
      acceptedAt: number;
      acceptedMutation: Record<string, unknown>;
      createdAt: number;
      mutation: Record<string, unknown>;
    };

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
      request: jest
        .fn()
        .mockResolvedValueOnce({ requests: [request] })
        .mockResolvedValue({}),
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
      .slice(1)
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
      request: jest.fn().mockResolvedValue(community),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Identity-Id': 'identity-1' }),
    } as unknown as RequestSigner;
    const invalidateCachedRequest = jest.fn();
    const session = {
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
});
