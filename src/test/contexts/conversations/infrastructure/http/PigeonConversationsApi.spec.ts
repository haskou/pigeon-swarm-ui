import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { PigeonConversationsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationsApi';

describe(PigeonConversationsApi.name, () => {
  const session = { identity: { id: 'identity-1' } } as unknown as Session;

  it('signs conversation list requests', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    http.request.mockResolvedValue({ conversations: [] });
    signer.headers.mockResolvedValue({ signature: 'signed' });
    const api = new PigeonConversationsApi(
      http,
      signer,
      new ConversationMapper(),
    );

    expect(await api.list(session)).toEqual([]);
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/conversations/?limit=30',
    );
    expect(http.request).toHaveBeenCalledWith('/conversations/?limit=30', {
      headers: { signature: 'signed' },
      method: 'GET',
    });
  });

  it('refreshes an empty list immediately when a conversation becomes available', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const mapper = mock<ConversationMapper>();
    const api = new PigeonConversationsApi(http, signer, mapper);
    const created = [{ id: 'created' }] as ReturnType<
      ConversationMapper['list']
    >;
    http.request
      .mockResolvedValueOnce('empty')
      .mockResolvedValueOnce('created');
    mapper.list.mockImplementation((value) =>
      value === 'created' ? created : [],
    );

    expect(await api.list(session)).toEqual([]);
    expect(await api.list(session)).toEqual(created);
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an older pending read when refreshing the list', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const mapper = mock<ConversationMapper>();
    const api = new PigeonConversationsApi(http, signer, mapper);
    let resolveOld!: (value: unknown) => void;
    const oldResponse = new Promise<unknown>((resolve) => {
      resolveOld = resolve;
    });
    const created = [{ id: 'created' }] as ReturnType<
      ConversationMapper['list']
    >;
    http.request.mockReturnValueOnce(oldResponse).mockResolvedValue('created');
    mapper.list.mockImplementation((value) =>
      value === 'created' ? created : [],
    );
    const oldRead = api.list(session);
    await Promise.resolve();

    expect(await api.list(session)).toEqual(created);
    resolveOld('empty');
    expect(await oldRead).toEqual([]);
    expect(await api.list(session)).toEqual(created);
    expect(http.request).toHaveBeenCalledTimes(3);
  });

  it('marks a conversation read until the requested message', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    signer.headers.mockResolvedValue({ signature: 'signature' });
    const api = new PigeonConversationsApi(
      http,
      signer,
      new ConversationMapper(),
    );

    await api.markReadUntil(session, 'conversation-1', 'message-1');

    expect(http.request).toHaveBeenCalledWith(
      '/conversations/conversation-1/messages/read-until',
      {
        body: JSON.stringify({ messageId: 'message-1' }),
        headers: { signature: 'signature' },
        method: 'PUT',
      },
    );
  });
});
