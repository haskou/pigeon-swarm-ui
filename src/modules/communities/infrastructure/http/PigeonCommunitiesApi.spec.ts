import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCommunitiesApi } from './PigeonCommunitiesApi';

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

  it('uses the last returned timeline item as fallback pagination cursor', async () => {
    const messages = [
      { id: 'message-2', type: 'sent' },
      { id: 'poll-1', pollId: 'poll-1', type: 'poll' },
    ];
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
      nextBeforeMessageId: 'poll-1',
    });
  });

  it('does not derive a fallback cursor from a partial channel message page', async () => {
    const messages = [{ id: 'message-1', type: 'sent' }];
    const http = {
      request: jest.fn().mockResolvedValue(messages),
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
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
    const api = new PigeonCommunitiesApi(
      http,
      signer,
      async (_key, loader) => await loader(),
    );
    const body = {
      attachmentExternalIdentifiers: [],
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
        attachmentExternalIdentifiers: [],
        authorIdentityId: 'identity-1',
        channelId: '6a073dc64d72b40039b156f8',
        communityId: '6a072ee87e00690039d0ad27',
        createdAt: 1779315464545,
        encryptedPayload: 'encrypted-payload',
        id: '6a072ee87e00690039d0ad27:6a073dc64d72b40039b156f8:1779315464545:cf164426-84b5-4eda-8e58-d9ef8b198f0d',
        mentions: [],
        type: 'sent',
      }),
      'secret',
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
    const session = {
      encryptedKeyPair: { sign },
      identity: { id: 'identity-1' },
      password: 'secret',
    } as unknown as Session;
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
      attachmentExternalIdentifiers: [],
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
        attachmentExternalIdentifiers: [],
        authorIdentityId: 'identity-1',
        channelId: 'channel-1',
        communityId: 'community-1',
        createdAt: 1773848929055,
        encryptedPayload: 'edited-encrypted-payload',
        id: 'message-1',
        mentions: [],
        type: 'edited',
      }),
      'secret',
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
});
