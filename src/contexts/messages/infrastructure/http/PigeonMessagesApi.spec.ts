import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { MessageProjectionPort } from '../crypto/MessageProjectionPort';

import { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import { PigeonMessagesApi } from './PigeonMessagesApi';

function httpClient(request: jest.Mock): HttpJsonClient {
  return {
    request,
    requestBlob: jest.fn(),
  } as unknown as HttpJsonClient;
}

function signer(headers: jest.Mock): RequestSigner {
  return { headers } as unknown as RequestSigner;
}

function projection(decryptMany: jest.Mock): MessageProjectionPort {
  return {
    decrypt: jest.fn(),
    decryptMany,
    list: jest.fn((value) => value as { messages: MessageResource[] }),
  };
}

describe(PigeonMessagesApi.name, () => {
  const session = { identity: { id: 'identity-1' } } as Session;

  it('loads and decrypts a paginated conversation timeline', async () => {
    const request = jest.fn().mockResolvedValue({ messages: ['raw-message'] });
    const headers = jest.fn().mockResolvedValue({ signature: 'signature' });
    const messages = [{ id: 'message-1' }] as ChatMessage[];
    const decryptMany = jest.fn().mockResolvedValue(messages);
    const api = new PigeonMessagesApi(
      httpClient(request),
      signer(headers),
      new RequestCache(),
      projection(decryptMany),
    );

    await expect(
      api.loadMessages(session, 'conversation-1', 'message-20', { limit: 20 }),
    ).resolves.toEqual({ messages, nextCursor: undefined });

    expect(request).toHaveBeenCalledWith(
      '/conversations/conversation-1/messages?limit=20&beforeMessageId=message-20',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/conversations/conversation-1/messages?limit=20&beforeMessageId=message-20',
    );
    expect(decryptMany).toHaveBeenCalledWith(
      session,
      'conversation-1',
      ['raw-message'],
      undefined,
    );
  });

  it('updates a reaction through the signed message endpoint', async () => {
    const request = jest.fn().mockResolvedValue(undefined);
    const headers = jest.fn().mockResolvedValue({ signature: 'signature' });
    const api = new PigeonMessagesApi(
      httpClient(request),
      signer(headers),
      new RequestCache(),
      projection(jest.fn()),
    );

    await api.addMessageReaction(session, 'conversation-1', 'message-1', '👍');

    expect(request).toHaveBeenCalledWith(
      '/conversations/conversation-1/messages/message-1/reactions',
      expect.objectContaining({
        body: JSON.stringify({ emoji: '👍' }),
        method: 'POST',
      }),
    );
  });
});
