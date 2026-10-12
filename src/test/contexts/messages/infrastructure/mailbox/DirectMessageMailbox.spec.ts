import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MailboxReadTokens } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { DirectMessageMailboxState } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import type {
  ChatMessage,
  ConversationResource,
  MessageResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxKeySchedule } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
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

  const conversation = {
    id: conversationId,
    participantIds: ['alice', 'bob'],
    type: 'one-to-one',
  } as unknown as ConversationResource;
  const plain = { attachmentCount: 0, hasReply: false, hasSticker: false };

  const credentialFor = (identityId: string): string =>
    `device-credential-${identityId}`;

  const session = (identityId: string): Session =>
    ({
      deviceCredentialKeyPair: {
        toPrimitives: () => ({ publicKey: credentialFor(identityId) }),
      },
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
      masterKey: {
        getBuffer: () => Buffer.alloc(32, identityId === 'alice' ? 3 : 9),
      },
    }) as unknown as Session;

  const keysFor = (identityId: string): MailboxKeys =>
    MailboxKeySchedule.derive(sharedSecret, identityId, 0);

  const deviceSession = (identityId: string, credential: string): Session =>
    ({
      ...session(identityId),
      deviceCredentialKeyPair: {
        toPrimitives: () => ({ publicKey: credential }),
      },
    }) as unknown as Session;

  const readerTokensFor = (
    identityId: string,
    mailboxId: string,
  ): MailboxReadTokens => {
    const masterKey = Buffer.alloc(32, identityId === 'alice' ? 3 : 9);

    return {
      device: MailboxReadToken.deriveDevice(
        masterKey,
        mailboxId,
        credentialFor(identityId),
      ),
      root: MailboxReadToken.derive(masterKey, mailboxId),
    };
  };

  const memoryStore = (): DirectMessageMailboxStore => {
    const records = new Map<string, DirectMessageMailboxState>();

    return {
      load: (mailboxId: string) => records.get(mailboxId) ?? null,
      save: (mailboxId: string, state: DirectMessageMailboxState) => {
        records.set(mailboxId, state);
      },
    } as unknown as DirectMessageMailboxStore;
  };

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
    channel.listReaders.mockResolvedValue({ maxReaders: 8, readers: [] });
    channel.addReader.mockResolvedValue(undefined);
    channel.removeReader.mockResolvedValue(undefined);
    const readerSet = new DirectMessageReaderSet(channel, (s) =>
      Promise.resolve([credentialFor(s.identity.id)]),
    );
    const projection = mock<Pick<MessageProjectionPort, 'decryptMany'>>();
    projection.decryptMany.mockImplementation((_session, _id, records) =>
      Promise.resolve(records.map(decrypted)),
    );
    const store = new DirectMessageMailboxStore();

    return {
      channel,
      clearStorage: () => storage.clear(),
      mailbox: new DirectMessageMailbox(channel, store, projection, readerSet),
      projection,
      store,
    };
  };

  const pageWith = (plaintext: Uint8Array, lastCursor: number) => ({
    envelopes: [{ cursor: lastCursor, envelopeId: 'envelope', plaintext }],
    hasMore: false,
    lastCursor,
    recreated: false,
  });

  describe('deliver', () => {
    it('appends the sent record to the recipient mailbox and reports delivery', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      const result = await mailbox.deliver(
        session('alice'),
        conversation,
        sent,
        plain,
      );

      expect(result).toBe('delivered');
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(expect.objectContaining({ id: 'message-1', type: 'sent' }));
    });

    it('reports a 404 from the recipient inbox as failed and logs one count-only line', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new MailboxUnavailableError());
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      await expect(
        mailbox.deliver(session('alice'), conversation, sent, plain),
      ).resolves.toBe('failed');
      expect(debug).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith(
        'Direct mailbox append failed; legacy copy kept.',
      );
      debug.mockRestore();
    });

    it('reports any other append failure as failed', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new Error('network down'));

      await expect(
        mailbox.deliver(session('alice'), conversation, sent, plain),
      ).resolves.toBe('failed');
    });

    it('reports failed without a conversation key and sends nothing', async () => {
      const { channel, mailbox } = setup();
      const keyless = {
        identity: { id: 'alice' },
        keychain: { conversations: {}, version: 1 },
      } as unknown as Session;

      await expect(
        mailbox.deliver(keyless, conversation, sent, plain),
      ).resolves.toBe('failed');
      expect(channel.send).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a group conversation',
        { ...conversation, type: 'group' } as ConversationResource,
        plain,
      ],
      ['an attachment', conversation, { ...plain, attachmentCount: 1 }],
      ['a reply', conversation, { ...plain, hasReply: true }],
      ['a sticker', conversation, { ...plain, hasSticker: true }],
    ])('skips %s and sends nothing', async (_label, conv, outgoing) => {
      const { channel, mailbox } = setup();

      await expect(
        mailbox.deliver(session('alice'), conv, sent, outgoing),
      ).resolves.toBe('skipped');
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('skips a message with no peer in the conversation', async () => {
      const { channel, mailbox } = setup();
      const alone = {
        ...conversation,
        participantIds: ['alice'],
      } as ConversationResource;

      await expect(
        mailbox.deliver(session('alice'), alone, sent, plain),
      ).resolves.toBe('skipped');
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
        recreated: false,
      });
      channel.acknowledge.mockImplementation(() => {
        order.push('ack');

        return Promise.resolve({ recreated: false });
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

      const [keys, readers, after] = channel.read.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('alice').mailboxId);
      expect(after).toBe(0);
      expect(readers).toEqual(readerTokensFor('alice', keys.mailboxId));
      expect(apply).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'message-1' }),
      ]);
      expect(channel.acknowledge).toHaveBeenCalledWith(keys, readers, 2);
      expect(order).toEqual(['apply', 'ack']);
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 2 });
    });

    it('creates the root reader for a new inbox, enrols this device reader, and stores only the cursor', async () => {
      const { channel, mailbox, store } = setup();
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 0,
        recreated: false,
      });

      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );

      const keys = keysFor('bob');
      const tokens = readerTokensFor('bob', keys.mailboxId);
      expect(channel.createInbox).toHaveBeenCalledWith(keys, tokens.root);
      expect(channel.addReader).toHaveBeenCalledWith(
        keys,
        tokens.root,
        tokens.device,
      );
      expect(channel.read.mock.calls[0][1]).toEqual(tokens);
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 0 });
    });

    it('does not touch the inbox when the pass is already superseded', async () => {
      const { channel, mailbox } = setup();
      const controller = new AbortController();
      controller.abort();

      await mailbox.sync(
        session('bob'),
        conversationId,
        controller.signal,
        jest.fn(),
      );

      expect(channel.createInbox).not.toHaveBeenCalled();
      expect(channel.read).not.toHaveBeenCalled();
    });

    it('does not read after the pass is superseded while its inbox is being created', async () => {
      const { channel, mailbox } = setup();
      let finishCreate!: (value: void) => void;
      channel.createInbox.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishCreate = resolve;
          }),
      );
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 0,
        recreated: false,
      });
      const controller = new AbortController();

      const pass = mailbox.sync(
        session('bob'),
        conversationId,
        controller.signal,
        jest.fn(),
      );
      controller.abort();
      finishCreate();
      await pass;

      expect(channel.read).not.toHaveBeenCalled();
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

      await mailbox.sync(
        session('alice'),
        conversationId,
        controller.signal,
        () => {
          controller.abort();
        },
      );

      expect(channel.acknowledge).not.toHaveBeenCalled();
      expect(store.load(keysFor('alice').mailboxId)?.cursor).toBe(0);
    });

    it('reads from the stored cursor and does nothing when nothing lies past it', async () => {
      const { channel, mailbox, store } = setup();
      store.save(keysFor('alice').mailboxId, { cursor: 5 });
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 5,
        recreated: false,
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
        readerTokensFor('alice', keysFor('alice').mailboxId),
        5,
        50,
      );
      expect(apply).not.toHaveBeenCalled();
      expect(channel.acknowledge).not.toHaveBeenCalled();
    });

    it('creates the recipient inbox before the first read on this device, once', async () => {
      const { channel, mailbox } = setup();
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 0,
        recreated: false,
      });
      const signal = new AbortController().signal;

      await mailbox.sync(session('alice'), conversationId, signal, jest.fn());
      await mailbox.sync(session('alice'), conversationId, signal, jest.fn());

      const [keys, root] = channel.createInbox.mock.calls[0];
      expect(channel.createInbox).toHaveBeenCalledTimes(1);
      expect(keys.mailboxId).toBe(keysFor('alice').mailboxId);
      expect(root).toBe(readerTokensFor('alice', keys.mailboxId).root);
      expect(channel.createInbox.mock.invocationCallOrder[0]).toBeLessThan(
        channel.read.mock.invocationCallOrder[0],
      );
      expect(channel.read.mock.calls[0][1]).toEqual(
        readerTokensFor('alice', keys.mailboxId),
      );
    });

    it('still reads when the up-front create fails, without a user error', async () => {
      const { channel, mailbox } = setup();
      channel.createInbox.mockRejectedValue(new Error('creation refused'));
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 0,
        recreated: false,
      });
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      await expect(
        mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          jest.fn(),
        ),
      ).resolves.toBeUndefined();

      expect(channel.read).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith(
        'Direct mailbox inbox create failed; read will retry.',
      );
      debug.mockRestore();
    });

    it('re-reads from zero when the inbox was re-created under a stored cursor', async () => {
      const { channel, mailbox, store } = setup();
      const keys = keysFor('alice');
      store.save(keys.mailboxId, { cursor: 5 });
      channel.read
        .mockResolvedValueOnce({
          envelopes: [],
          hasMore: false,
          lastCursor: 5,
          recreated: true,
        })
        .mockResolvedValueOnce(
          pageWith(DirectMessageMailboxRecord.encode(storedRecord), 1),
        );
      const apply = jest.fn();
      channel.acknowledge.mockResolvedValue({ recreated: false });

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).toHaveBeenNthCalledWith(
        2,
        keys,
        readerTokensFor('alice', keys.mailboxId),
        0,
        50,
      );
      expect(apply).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'message-1' }),
      ]);
      expect(channel.acknowledge).toHaveBeenCalledWith(
        keys,
        readerTokensFor('alice', keys.mailboxId),
        1,
      );
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 1 });
    });

    it('stores cursor zero when the inbox was re-created during acknowledgement', async () => {
      const { channel, mailbox, store } = setup();
      channel.read.mockResolvedValue(
        pageWith(DirectMessageMailboxRecord.encode(storedRecord), 1),
      );
      channel.acknowledge.mockResolvedValue({ recreated: true });

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );

      expect(store.load(keysFor('alice').mailboxId)?.cursor).toBe(0);
    });

    it('adopts a legacy inbox by registering the root and device readers under its stored token', async () => {
      const { channel, mailbox, store } = setup();
      const keys = keysFor('alice');
      const tokens = readerTokensFor('alice', keys.mailboxId);
      store.save(keys.mailboxId, { cursor: 5, readToken: 'legacy-read-token' });
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 5,
        recreated: false,
      });

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );

      expect(channel.addReader).toHaveBeenCalledWith(
        keys,
        'legacy-read-token',
        tokens.root,
      );
      expect(channel.addReader).toHaveBeenCalledWith(
        keys,
        'legacy-read-token',
        tokens.device,
      );
      expect(channel.read.mock.calls[0][1]).toEqual(tokens);
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 5 });
    });

    it('treats a legacy inbox that no longer exists as fresh, starting from cursor zero', async () => {
      const { channel, mailbox, store } = setup();
      const keys = keysFor('alice');
      const tokens = readerTokensFor('alice', keys.mailboxId);
      store.save(keys.mailboxId, { cursor: 5, readToken: 'legacy-read-token' });
      channel.addReader.mockRejectedValueOnce(new MailboxUnavailableError());
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 0,
        recreated: false,
      });

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );

      expect(channel.createInbox).toHaveBeenCalledWith(keys, tokens.root);
      expect(channel.read.mock.calls[0][1]).toEqual(tokens);
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 0 });
    });

    it('keeps the legacy state and surfaces the error when adoption fails for another reason', async () => {
      const { channel, mailbox, store } = setup();
      const keys = keysFor('alice');
      store.save(keys.mailboxId, { cursor: 5, readToken: 'legacy-read-token' });
      channel.addReader.mockRejectedValueOnce(new Error('offline'));

      await expect(
        mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          jest.fn(),
        ),
      ).rejects.toThrow('offline');

      expect(channel.read).not.toHaveBeenCalled();
      expect(store.load(keys.mailboxId)).toEqual({
        cursor: 5,
        readToken: 'legacy-read-token',
      });
    });
  });

  describe('over the real channel', () => {
    /**
     * Mirrors the node: the inbox keeps the hash of every reader token with
     * the cursor that reader has acknowledged. An envelope is kept until the
     * slowest reader has acknowledged it, and reads or acknowledgements need a
     * token whose hash is registered.
     */
    const nodeMailboxClient = (createGate?: Promise<void>) => {
      let present = true;
      let creates = 0;
      let nextCursor = 1;
      let envelopes: { body: string; cursor: number; envelopeId: string }[] =
        [];
      const readers = new Map<string, number>();
      const requireReader = (readToken: string) => {
        if (!present || !readers.has(MailboxCapability.hash(readToken))) {
          throw new MailboxUnavailableError();
        }
      };
      const retainUnacknowledged = () => {
        if (readers.size === 0) return;
        const floor = Math.min(...Array.from(readers.values()));
        envelopes = envelopes.filter((envelope) => envelope.cursor > floor);
      };
      const wire = mock<PigeonMailboxClient>();
      wire.create.mockImplementation(async (_mailboxId, creation) => {
        creates += 1;
        await createGate;

        if (present && readers.size > 0) {
          if (!readers.has(creation.readTokenHash)) {
            throw new Error('mailbox exists with other capabilities');
          }

          return;
        }

        if (!present) {
          present = true;
          nextCursor = 1;
          envelopes = [];
        }
        readers.set(creation.readTokenHash, 0);
      });
      wire.readers.mockImplementation((_mailboxId, readToken) => {
        requireReader(readToken);

        return Promise.resolve({
          maxReaders: 8,
          readers: Array.from(readers, ([readTokenHash, ackedCursor]) => ({
            ackedCursor,
            readTokenHash,
          })),
        });
      });
      wire.addReader.mockImplementation(
        (_mailboxId, readToken, readTokenHash) => {
          requireReader(readToken);

          if (!readers.has(readTokenHash)) readers.set(readTokenHash, 0);

          return Promise.resolve();
        },
      );
      wire.removeReader.mockImplementation(
        (_mailboxId, readToken, readTokenHash) => {
          requireReader(readToken);
          readers.delete(readTokenHash);
          retainUnacknowledged();

          return Promise.resolve();
        },
      );
      wire.append.mockImplementation((_mailboxId, _postToken, input) => {
        if (!present) throw new MailboxUnavailableError();
        const cursor = nextCursor;
        nextCursor += 1;
        envelopes.push({ ...input, cursor });

        return Promise.resolve({ cursor });
      });
      wire.read.mockImplementation((_mailboxId, readToken, after, limit) => {
        requireReader(readToken);

        return Promise.resolve({
          envelopes: envelopes
            .filter((envelope) => envelope.cursor > after)
            .slice(0, limit),
          hasMore: false,
        });
      });
      wire.acknowledge.mockImplementation((_mailboxId, readToken, upTo) => {
        requireReader(readToken);
        const readTokenHash = MailboxCapability.hash(readToken);
        readers.set(
          readTokenHash,
          Math.max(readers.get(readTokenHash) ?? 0, upTo),
        );
        retainUnacknowledged();

        return Promise.resolve();
      });

      return {
        creates: () => creates,
        envelopeCount: () => envelopes.length,
        evict: () => {
          present = false;
          readers.clear();
          envelopes = [];
        },
        wire,
      };
    };

    const mailboxFor = (
      wire: PigeonMailboxClient,
      store: DirectMessageMailboxStore,
      projection: Pick<MessageProjectionPort, 'decryptMany'>,
      catalog: readonly string[] = [credentialFor('bob')],
    ): DirectMessageMailbox => {
      const channel = new MailboxChannel(wire, jest.fn());
      const readerSet = new DirectMessageReaderSet(channel, () =>
        Promise.resolve(catalog),
      );

      return new DirectMessageMailbox(channel, store, projection, readerSet);
    };

    it('delivers a message once and does not replay it after acknowledgement', async () => {
      const { projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const applied: string[][] = [];
      const recordApplied = (messages: ChatMessage[]) => {
        applied.push(messages.map((message) => message.id));
      };

      await expect(
        mailbox.deliver(session('alice'), conversation, sent, plain),
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
      // The device reader acks first; the root reader mirrors the cursor.
      expect(wire.acknowledge).toHaveBeenCalledTimes(2);
      expect(wire.acknowledge.mock.calls.map((call) => call[2])).toEqual([
        1, 1,
      ]);
      expect(wire.acknowledge.mock.calls[0][1]).toBe(
        readerTokensFor('bob', keysFor('bob').mailboxId).device,
      );
    });

    it('shows one message when the legacy copy and the mailbox copy share an id', async () => {
      const { projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      let timeline: ChatMessage[] = [decrypted(sent)];

      await mailbox.deliver(session('alice'), conversation, sent, plain);
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

    it('delivers after the inbox was evicted and re-created under a stored cursor', async () => {
      const { projection, store } = setup();
      const { evict, wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const applied: string[][] = [];
      const sync = () =>
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          (messages) => {
            applied.push(messages.map((message) => message.id));
          },
        );

      await mailbox.deliver(session('alice'), conversation, sent, plain);
      await sync();
      evict();
      await sync();
      await mailbox.deliver(
        session('alice'),
        conversation,
        { ...sent, id: 'message-2' },
        plain,
      );
      await sync();

      expect(applied).toEqual([['message-1'], ['message-2']]);
    });

    it('reads the inbox again after the device lost its local storage', async () => {
      const { clearStorage, projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const applied: string[][] = [];
      const sync = () =>
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          (messages) => {
            applied.push(messages.map((message) => message.id));
          },
        );

      await sync();
      await mailbox.deliver(session('alice'), conversation, sent, plain);
      await sync();
      clearStorage();
      await mailbox.deliver(
        session('alice'),
        conversation,
        { ...sent, id: 'message-2' },
        plain,
      );
      await sync();

      expect(applied).toEqual([['message-1'], ['message-2']]);
    });

    it('creates the inbox once when a superseded pass overlaps the next one', async () => {
      const { projection, store } = setup();
      let releaseCreate!: (value: void) => void;
      const gate = new Promise<void>((resolve) => {
        releaseCreate = resolve;
      });
      const { creates, wire } = nodeMailboxClient(gate);
      const mailbox = mailboxFor(wire, store, projection);
      // StrictMode runs the mount effect twice: the first pass is aborted
      // while its create is in flight.
      const firstPass = new AbortController();
      const first = mailbox.sync(
        session('bob'),
        conversationId,
        firstPass.signal,
        jest.fn(),
      );
      firstPass.abort();
      const second = mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      releaseCreate();

      await Promise.all([first, second]);

      expect(creates()).toBe(1);
    });

    it('lets a sender deliver without the recipient root key', async () => {
      const { projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const senderWithoutRootKey = {
        ...session('alice'),
        masterKey: undefined,
      } as unknown as Session;

      await expect(
        mailbox.deliver(senderWithoutRootKey, conversation, sent, plain),
      ).resolves.toBe('delivered');
    });

    it('keeps an envelope until every device of the identity has acknowledged it', async () => {
      const { projection } = setup();
      const { envelopeCount, wire } = nodeMailboxClient();
      const catalog = ['credential-phone', 'credential-laptop'];
      const phoneStore = memoryStore();
      const laptopStore = memoryStore();
      const sender = mailboxFor(wire, memoryStore(), projection, catalog);
      const phone = mailboxFor(wire, phoneStore, projection, catalog);
      const laptop = mailboxFor(wire, laptopStore, projection, catalog);
      const phoneSession = deviceSession('bob', 'credential-phone');
      const laptopSession = deviceSession('bob', 'credential-laptop');
      const phoneApplied: string[][] = [];
      const laptopApplied: string[][] = [];
      const recordInto = (applied: string[][]) => (messages: ChatMessage[]) => {
        applied.push(messages.map((message) => message.id));
      };

      await phone.sync(
        phoneSession,
        conversationId,
        new AbortController().signal,
        recordInto(phoneApplied),
      );
      await laptop.sync(
        laptopSession,
        conversationId,
        new AbortController().signal,
        recordInto(laptopApplied),
      );
      await sender.deliver(session('alice'), conversation, sent, plain);
      await phone.sync(
        phoneSession,
        conversationId,
        new AbortController().signal,
        recordInto(phoneApplied),
      );
      await laptop.sync(
        laptopSession,
        conversationId,
        new AbortController().signal,
        recordInto(laptopApplied),
      );

      expect(phoneApplied).toEqual([['message-1']]);
      expect(laptopApplied).toEqual([['message-1']]);
      expect(envelopeCount()).toBe(0);
    });
  });
});
