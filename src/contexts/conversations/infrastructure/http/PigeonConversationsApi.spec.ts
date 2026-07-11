import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { ConversationMapper } from './ConversationMapper';
import { PigeonConversationsApi } from './PigeonConversationsApi';

describe(PigeonConversationsApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('lists conversations through the signed cached request', async () => {
    const request = jest.fn().mockResolvedValue({ conversations: [] });
    const headers = jest.fn().mockResolvedValue({});
    const load = jest
      .fn<
        Promise<unknown>,
        [string, () => Promise<unknown>, { ttlMs?: number }]
      >()
      .mockImplementation(async (_key, loader) => await loader());
    const api = new PigeonConversationsApi(
      { request } as unknown as HttpJsonClient,
      { headers } as unknown as RequestSigner,
      new ConversationMapper(),
      {
        keyForSession: jest.fn().mockReturnValue('cache-key'),
        load,
      } as unknown as RequestCache,
    );

    await expect(api.list(session)).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith('/conversations/?limit=30', {
      headers: {},
      method: 'GET',
    });
    expect(load).toHaveBeenCalledWith('cache-key', expect.any(Function), {
      ttlMs: 1500,
    });
  });

  it('marks a conversation read until the requested message', async () => {
    const request = jest.fn().mockResolvedValue(undefined);
    const headers = jest.fn().mockResolvedValue({ signature: 'signature' });
    const api = new PigeonConversationsApi(
      { request } as unknown as HttpJsonClient,
      { headers } as unknown as RequestSigner,
      new ConversationMapper(),
      {} as RequestCache,
    );

    await api.markReadUntil(session, 'conversation-1', 'message-1');

    expect(request).toHaveBeenCalledWith(
      '/conversations/conversation-1/messages/read-until',
      {
        body: JSON.stringify({ messageId: 'message-1' }),
        headers: { signature: 'signature' },
        method: 'PUT',
      },
    );
  });
});
