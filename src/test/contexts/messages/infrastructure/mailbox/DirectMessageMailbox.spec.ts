import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type {
  ChatMessage,
  MessageResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';

import { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import { MailboxKeySchedule } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { MessageCollection } from '../../../../../contexts/messages/presentation/view-models/MessageCollection';

describe(DirectMessageMailbox.name, () => {
  const sharedSecret = Buffer.alloc(32, 7);
  const conversationId = 'conversation-1';
  const sent: MessageResource = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };
  const storedRecord = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
  };

  const session = (identityId: string): Session =>
    ({
      identity: { id: identityId },
      keychain: {
        conversations: {
          [conversationId]: {
            algorithm: 'aes-256-gcm',
            conversationId,
            createdAt: 1,
            key: sharedSecret.toString('base64'),
            kind: 'conversation',
            peerIdentityId: identityId === 'alice' ? 'bob' : 'alice',
            version: 2,
          },
        },
        version: 1,
      },
    }) as unknown as Session;

  const keysFor = (identityId: string): MailboxKeys =>
    MailboxKeySchedule.derive(sharedSecret, identityId, 0);

  const decrypted = (message: MessageResource): ChatMessage =>
    ({
      id: message.id,
      raw: message,
      text: 'decrypted',
      timestamp: message.createdAt,
    }) as unknown as ChatMessage;

  const setup = () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });

    const channel = mock<MailboxChannel>();
    const projection = mock<Pick<MessageProjectionPort, 'decryptMany'>>();
    projection.decryptMany.mockImplementation((_session, _id, records) =>
      Promise.resolve(records.map(decrypted)),
    );
    const store = new DirectMessageMailboxStore();

    return {
      channel,
      mailbox: new DirectMessageMailbox(channel, store, projection),
      projection,
      store,
    };
  };

  const pageWith = (plaintext: Uint8Array, lastCursor: number) => ({
    envelopes: [{ cursor: lastCursor, envelopeId: 'envelope', plaintext }],
    hasMore: false,
    lastCursor,
  });

  describe('deliver', () => {
    it('appends the sent record to the recipient mailbox and reports delivery', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      const result = await mailbox.deliver(
        session('alice'),
        conversationId,
        'bob',
        sent,
      );

      expect(result).toBe('delivered');
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(expect.objectContaining({ id: 'message-1', type: 'sent' }));
    });

    it('reports a 404 from the recipient inbox as failed instead of dropping silently', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new MailboxUnavailableError());

      await expect(
        mailbox.deliver(session('alice'), conversationId, 'bob', sent),
      ).resolves.toBe('failed');
    });

    it('reports any other append failure as failed', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new Error('network down'));

      await expect(
        mailbox.deliver(session('alice'), conversationId, 'bob', sent),
      ).resolves.toBe('failed');
    });

    it('reports failed without a conversation key and sends nothing', async () => {
      const { channel, mailbox } = setup();
      const keyless = {
        identity: { id: 'alice' },
        keychain: { conversations: {}, version: 1 },
      } as unknown as Session;

      await expect(
        mailbox.deliver(keyless, conversationId, 'bob', sent),
      ).resolves.toBe('failed');
      expect(channel.send).not.toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    it('applies decrypted messages, skips malformed envelopes, then acknowledges and persists the cursor', async () => {
      const { channel, mailbox, store } = setup();
      const order: string[] = [];
      channel.read.mockResolvedValue({
        envelopes: [
          {
            cursor: 1,
            envelopeId: 'envelope-1',
            plaintext: DirectMessageMailboxRecord.encode(storedRecord),
          },
          {
            cursor: 2,
            envelopeId: 'envelope-2',
            plaintext: new TextEncoder().encode('not a record'),
          },
        ],
        hasMore: false,
        lastCursor: 2,
      });
      channel.acknowledge.mockImplementation(() => {
        order.push('ack');

        return Promise.resolve();
      });
      const apply = jest.fn(() => {
        order.push('apply');
      });

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      const [keys, readToken, after] = channel.read.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('alice').mailboxId);
      expect(after).toBe(0);
      expect(apply).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'message-1' }),
      ]);
      expect(channel.acknowledge).toHaveBeenCalledWith(keys, readToken, 2);
      expect(order).toEqual(['apply', 'ack']);
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 2, readToken });
    });

    it('keeps the cursor and the inbox untouched when apply throws', async () => {
      const { channel, mailbox, store } = setup();
      channel.read.mockResolvedValue(
        pageWith(DirectMessageMailboxRecord.encode(storedRecord), 1),
      );

      await expect(
        mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          () => {
            throw new Error('timeline failed');
          },
        ),
      ).rejects.toThrow('timeline failed');

      expect(channel.acknowledge).not.toHaveBeenCalled();
      expect(store.load(keysFor('alice').mailboxId)?.cursor).toBe(0);
    });

    it('does not acknowledge when the conversation is switched after apply', async () => {
      const { channel, mailbox, store } = setup();
      channel.read.mockResolvedValue(
        pageWith(DirectMessageMailboxRecord.encode(storedRecord), 1),
      );
      const controller = new AbortController();

      await mailbox.sync(session('alice'), conversationId, controller.signal, () => {
        controller.abort();
      });

      expect(channel.acknowledge).not.toHaveBeenCalled();
      expect(store.load(keysFor('alice').mailboxId)?.cursor).toBe(0);
    });

    it('reads from the stored cursor and does nothing when nothing lies past it', async () => {
      const { channel, mailbox, store } = setup();
      store.save(keysFor('alice').mailboxId, {
        cursor: 5,
        readToken: 'read-token',
      });
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 5,
      });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).toHaveBeenCalledWith(
        keysFor('alice'),
        'read-token',
        5,
        50,
      );
      expect(apply).not.toHaveBeenCalled();
      expect(channel.acknowledge).not.toHaveBeenCalled();
    });
  });

  describe('over the real channel', () => {
    const inMemoryMailboxClient = () => {
      const envelopes: { body: string; cursor: number; envelopeId: string }[] =
        [];
      const wire = mock<PigeonMailboxClient>();
      wire.append.mockImplementation((_mailboxId, _postToken, input) => {
        const cursor = envelopes.length + 1;
        envelopes.push({ ...input, cursor });

        return Promise.resolve({ cursor });
      });
      wire.read.mockImplementation((_mailboxId, _readToken, after, limit) =>
        Promise.resolve({
          envelopes: envelopes
            .filter((envelope) => envelope.cursor > after)
            .slice(0, limit),
          hasMore: false,
        }),
      );
      wire.acknowledge.mockResolvedValue(undefined);

      return wire;
    };

    it('delivers a message once and does not replay it after acknowledgement', async () => {
      const { projection, store } = setup();
      const wire = inMemoryMailboxClient();
      const mailbox = new DirectMessageMailbox(
        new MailboxChannel(wire, jest.fn()),
        store,
        projection,
      );
      const applied: string[][] = [];
      const recordApplied = (messages: ChatMessage[]) => {
        applied.push(messages.map((message) => message.id));
      };

      await expect(
        mailbox.deliver(session('alice'), conversationId, 'bob', sent),
      ).resolves.toBe('delivered');

      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        recordApplied,
      );
      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        recordApplied,
      );

      expect(applied).toEqual([['message-1']]);
      expect(wire.acknowledge).toHaveBeenCalledTimes(1);
      expect(wire.acknowledge.mock.calls[0][2]).toBe(1);
    });

    it('shows one message when the legacy copy and the mailbox copy share an id', async () => {
      const { projection, store } = setup();
      const wire = inMemoryMailboxClient();
      const mailbox = new DirectMessageMailbox(
        new MailboxChannel(wire, jest.fn()),
        store,
        projection,
      );
      let timeline: ChatMessage[] = [decrypted(sent)];

      await mailbox.deliver(session('alice'), conversationId, 'bob', sent);
      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        (messages) => {
          timeline = MessageCollection.merge(timeline, messages);
        },
      );

      expect(timeline.map((message) => message.id)).toEqual(['message-1']);
    });
  });
});
