import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';

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

  describe('signed mutations', () => {
    type Sent = {
      createdAt?: number;
      emoji?: string;
      mutation: Record<string, unknown>;
    };

    async function setup(): Promise<{
      api: PigeonMessagesApi;
      request: jest.Mock;
      sent: () => Sent[];
      signed: Session;
    }> {
      const request = jest.fn().mockResolvedValue(undefined);
      const headers = jest.fn().mockResolvedValue({ signature: 'signature' });
      const signed = {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identity: { id: 'identity-1' },
      } as unknown as Session;
      const api = new PigeonMessagesApi(
        httpClient(request),
        signer(headers),
        new RequestCache(),
        projection(jest.fn()),
      );

      return {
        api,
        request,
        sent: () =>
          request.mock.calls.map(
            ([, init]: [string, { body: string }]) =>
              JSON.parse(init.body) as Sent,
          ),
        signed,
      };
    }

    it('pins and unpins conversation messages', async () => {
      const { api, request, sent, signed } = await setup();
      const path = '/conversations/conversation-1/messages/message-1/pin';

      await api.pinMessage(signed, 'conversation-1', 'message-1');
      await api.unpinMessage(signed, 'conversation-1', 'message-1');

      const [pin, unpin] = sent();

      expect(request).toHaveBeenNthCalledWith(
        1,
        path,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(request).toHaveBeenNthCalledWith(
        2,
        path,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(pin.createdAt).toEqual(expect.any(Number));
      expect(pin.mutation).toMatchObject({
        kind: 'put',
        predecessor: null,
        recordId: 'conversation:conversation-1:message-1',
        sequence: 0,
        store: 'pins',
        version: 1,
      });
      expect(unpin.mutation).toMatchObject({
        kind: 'delete',
        recordId: 'conversation:conversation-1:message-1',
        store: 'pins',
      });
    });

    it('adds and removes conversation message reactions', async () => {
      const { api, request, sent, signed } = await setup();
      const path = '/conversations/conversation-1/messages/message-1/reactions';
      const recordId = 'conversation:conversation-1:message-1:identity-1:👍';

      await api.addMessageReaction(signed, 'conversation-1', 'message-1', '👍');
      await api.removeMessageReaction(
        signed,
        'conversation-1',
        'message-1',
        '👍',
      );

      const [add, remove] = sent();

      expect(request).toHaveBeenNthCalledWith(
        1,
        path,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(request).toHaveBeenNthCalledWith(
        2,
        path,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(add).toMatchObject({ createdAt: expect.any(Number), emoji: '👍' });
      expect(add.mutation).toMatchObject({
        kind: 'put',
        recordId,
        store: 'reactions',
      });
      expect(remove.emoji).toBe('👍');
      expect(remove.mutation).toMatchObject({
        kind: 'delete',
        recordId,
        store: 'reactions',
      });
    });
  });
});
