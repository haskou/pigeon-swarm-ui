import 'fake-indexeddb/auto';
import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { ConversationResource } from '../../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectDeletedRecord } from '../../../../../contexts/mailboxes/domain/DirectDeletedRecord';
import type { DirectEditedRecord } from '../../../../../contexts/mailboxes/domain/DirectEditedRecord';
import type { DirectMessageRecord } from '../../../../../contexts/mailboxes/domain/DirectMessageRecord';
import type { DirectPinRecord } from '../../../../../contexts/mailboxes/domain/DirectPinRecord';
import type { DirectReactionRecord } from '../../../../../contexts/mailboxes/domain/DirectReactionRecord';
import type { DirectReadRecord } from '../../../../../contexts/mailboxes/domain/DirectReadRecord';
import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';
import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from '../../../../../contexts/mailboxes/infrastructure/http/PigeonMailboxClient';
import type { MailboxReadTokens } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import type { DirectMessageMailboxState } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import type { ChatMessage } from '../../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../../contexts/messages/presentation/view-models/DirectMessageTimelineChange';

import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxEnvelopeCipher } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxReadToken';
import { MailboxUnavailableError } from '../../../../../contexts/mailboxes/infrastructure/http/MailboxUnavailableError';
import { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';
import { DirectMessageAuthorship } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAuthorship';
import { DirectMessageHistoryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryStore';
import { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { DirectMessageMailboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxStore';
import { DirectMessageOutboxStore } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageOutboxStore';
import { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { RecipientMailboxRouter } from '../../../../../contexts/messages/infrastructure/mailbox/RecipientMailboxRouter';
import { MessageCollection } from '../../../../../contexts/messages/presentation/view-models/MessageCollection';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

type ComposedRecords = {
  edited: MessageResource & { id: string };
  sent: MessageResource & { id: string };
};

describe(DirectMessageMailbox.name, () => {
  const sharedSecret = Buffer.alloc(32, 7);
  const conversationId = 'conversation-1';
  const sent: MessageResource & { id: string } = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };
  const storedRecord: DirectSentRecord = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };

  const conversation = {
    id: conversationId,
    networkId: 'network-1',
    participantIds: ['alice', 'bob'],
    type: 'one-to-one',
  } as unknown as ConversationResource;

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

  /** The device-sealed root that tags and reads use once a device holds one. */
  const sealedRoot = Buffer.alloc(32, 5);
  const withSealedRoot = (base: Session): Session =>
    ({
      ...base,
      deviceSealedRootKey: SymmetricKey.fromBuffer(sealedRoot),
    }) as unknown as Session;

  /** Alice's own inbox copy, tagged under her root key as the sender does. */
  const ownEncode = (record: DirectMessageRecord): Uint8Array =>
    DirectMessageMailboxRecord.encode(
      record,
      DirectMessageAuthorship.tag(
        session('alice').masterKey.getBuffer(),
        record,
      ),
    );

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

  /** The decrypt port: a record projects to the `decrypted` stand-in. */
  const projectionDouble = () => {
    const port = mock<Pick<MessageProjectionPort, 'decrypt' | 'decryptMany'>>();
    port.decrypt.mockImplementation((_session, _id, message) =>
      Promise.resolve(decrypted(message)),
    );
    port.decryptMany.mockImplementation((_session, _id, records) =>
      Promise.resolve(records.map(decrypted)),
    );

    return port;
  };

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
    const projection = projectionDouble();
    const store = new DirectMessageMailboxStore();
    const { composed, composer } = composerDouble();

    return {
      channel,
      clearStorage: () => storage.clear(),
      composed,
      composer,
      mailbox: new DirectMessageMailbox(
        channel,
        new RecipientMailboxRouter(
          channel,
          () => Promise.resolve(undefined),
          () => channel,
        ),
        store,
        projection,
        readerSet,
        composer,
      ),
      projection,
      store,
    };
  };

  /**
   * Resolves once no send of this identity is still being delivered in the
   * test conversation: every queued send is written and removed, or failed.
   */
  const outboxSettled = (
    mailbox: DirectMessageMailbox,
    identityId: string,
  ): Promise<void> =>
    new Promise<void>((resolve) => {
      const check = (): void => {
        if (
          mailbox
            .outboxItems(identityId, conversationId)
            .every((item) => item.state === 'failed')
        ) {
          resolve();
        }
      };

      mailbox.subscribeOutbox(check);
      check();
    });

  const pageWith = (plaintext: Uint8Array, lastCursor: number) => ({
    envelopes: [{ cursor: lastCursor, envelopeId: 'envelope', plaintext }],
    hasMore: false,
    lastCursor,
    recreated: false,
  });

  const messageIds = (changes: DirectMessageTimelineChange[]): string[] =>
    changes.flatMap((change) =>
      change.kind === 'message' ? [change.message.id] : [],
    );

  const messagesOf = (changes: DirectMessageTimelineChange[]): ChatMessage[] =>
    changes.flatMap((change) =>
      change.kind === 'message' ? [change.message] : [],
    );

  const pageOf = (plaintexts: Uint8Array[]) => ({
    envelopes: plaintexts.map((plaintext, index) => ({
      cursor: index + 1,
      envelopeId: `envelope-${index + 1}`,
      plaintext,
    })),
    hasMore: false,
    lastCursor: plaintexts.length,
    recreated: false,
  });

  const edited: MessageResource & { id: string } = {
    authorId: 'alice',
    conversationId,
    createdAt: 200,
    encryptedPayload: 'ciphertext-2',
    id: 'edit-1',
    previousMessageIds: ['message-1'],
    targetMessageId: 'message-1',
    type: 'edited',
  };
  const reaction = {
    action: 'add',
    createdAt: 300,
    emoji: '👍',
    messageId: 'message-1',
  } as const;
  const composedRecords = (): ComposedRecords => ({ edited, sent });
  /**
   * Stands in for the composer in PigeonMessageCommandsApi: it hands the
   * mailbox the record a test sets on `composed`, without encrypting or
   * publishing.
   */
  const composerDouble = (composed = composedRecords()) => {
    const composer =
      mock<Pick<PigeonMessageCommandsApi, 'composeEdit' | 'withSentRecord'>>();

    composer.composeEdit.mockImplementation(() =>
      Promise.resolve(composed.edited),
    );
    composer.withSentRecord.mockImplementation(
      (_session, _id, _content, _options, deliver) => deliver(composed.sent),
    );

    return { composed, composer };
  };
  const deliveries: [
    string,
    (
      mailbox: DirectMessageMailbox,
      from: Session,
      conv: ConversationResource,
    ) => Promise<unknown>,
  ][] = [
    [
      'edited',
      (mailbox, from, conv) =>
        mailbox.edit(from, conv, 'message-1', 'edited', {}),
    ],
    [
      'deleted',
      (mailbox, from, conv) => mailbox.delete(from, conv, 'message-1'),
    ],
    [
      'reaction',
      (mailbox, from, conv) => mailbox.reaction(from, conv, reaction),
    ],
  ];

  const sentDelivery: (typeof deliveries)[number] = [
    'sent',
    (mailbox, from, conv) => mailbox.send(from, conv, 'hello', {}),
  ];

  describe('send', () => {
    it('writes the sent record to the recipient mailbox and resolves the projected message', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      await expect(
        mailbox.send(session('alice'), conversation, 'hello', {}),
      ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(expect.objectContaining({ id: 'message-1', type: 'sent' }));
    });

    it('delivers a reply as a sent record', async () => {
      const { channel, composed, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
      composed.sent = { ...sent, replyToMessageId: 'message-0' };

      await mailbox.send(session('alice'), conversation, 'hello', {});
      const [, plaintext] = channel.send.mock.calls[0];
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(
        expect.objectContaining({
          replyToMessageId: 'message-0',
          type: 'sent',
        }),
      );
    });

    it('delivers a payload just under the envelope bound', async () => {
      const { channel, composed, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
      composed.sent = {
        ...sent,
        encryptedPayload: 'x'.repeat(
          MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES - 500,
        ),
      };

      await expect(
        mailbox.send(session('alice'), conversation, 'hello', {}),
      ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));
    });

    it('retries the peer append while the recipient inbox is not open yet, then delivers and writes the own copy', async () => {
      jest.useFakeTimers();
      const { channel, mailbox } = setup();
      channel.send
        .mockRejectedValueOnce(new MailboxUnavailableError())
        .mockRejectedValueOnce(new MailboxUnavailableError())
        .mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      const delivery = mailbox.send(
        session('alice'),
        conversation,
        'hello',
        {},
      );
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(delivery).resolves.toMatchObject({ id: 'message-1' });
      expect(channel.send).toHaveBeenCalledTimes(4);
      jest.useRealTimers();
    });

    it('rejects a payload over the envelope bound and sends nothing', async () => {
      const { channel, composed, mailbox } = setup();
      composed.sent = {
        ...sent,
        encryptedPayload: 'x'.repeat(MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES),
      };

      await expect(
        mailbox.send(session('alice'), conversation, 'hello', {}),
      ).rejects.toThrow();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('queues the send as failed when the peer append fails, and writes no own copy', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValueOnce(new Error('peer inbox down'));

      await mailbox.send(session('alice'), conversation, 'hello', {});
      await outboxSettled(mailbox, 'alice');

      expect(mailbox.outboxItems('alice', conversationId)).toEqual([
        expect.objectContaining({ id: 'message-1', state: 'failed' }),
      ]);
      expect(channel.send).toHaveBeenCalledTimes(1);
    });

    it('forces attachments private for the peer, whatever the caller asks', async () => {
      const { channel, composer, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      const alice = session('alice');

      await mailbox.send(alice, conversation, 'hello', {
        attachmentUpload: {
          encryptLargeAttachments: false,
          encryptSmallAttachments: false,
        },
      });

      expect(composer.withSentRecord).toHaveBeenCalledWith(
        alice,
        conversationId,
        'hello',
        expect.objectContaining({
          attachmentUpload: {
            encryptLargeAttachments: true,
            encryptSmallAttachments: true,
            networkId: 'network-1',
            recipientIdentityId: 'bob',
          },
        }),
        expect.any(Function),
        undefined,
      );
    });

    it('queues nothing and rejects without a conversation key', async () => {
      const { channel, mailbox } = setup();
      const keyless = {
        identity: { id: 'alice' },
        keychain: { conversations: {}, version: 1 },
      } as unknown as Session;

      await expect(
        mailbox.send(keyless, conversation, 'hello', {}),
      ).rejects.toThrow();
      expect(channel.send).not.toHaveBeenCalled();
      expect(mailbox.outboxItems('alice', conversationId)).toEqual([]);
    });

    it('queues nothing and rejects for a group conversation', async () => {
      const { channel, mailbox } = setup();
      const group = { ...conversation, type: 'group' } as ConversationResource;

      await expect(
        mailbox.send(session('alice'), group, 'hello', {}),
      ).rejects.toThrow();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('keeps the send in retry, logging nothing, while the recipient inbox stays missing', async () => {
      jest.useFakeTimers();
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new MailboxUnavailableError());
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      await mailbox.send(session('alice'), conversation, 'hello', {});
      await jest.advanceTimersByTimeAsync(60_000);

      expect(mailbox.outboxItems('alice', conversationId)).toEqual([
        expect.objectContaining({ id: 'message-1', state: 'retry' }),
      ]);
      expect(debug).not.toHaveBeenCalled();
      debug.mockRestore();
      jest.useRealTimers();
    });

    describe('queued sends across unlock and forget', () => {
      beforeEach(async () => {
        await new DirectMessageOutboxStore().forget('alice');
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('projects queued sends as decrypted messages', async () => {
        jest.useFakeTimers();
        const { channel, mailbox } = setup();
        channel.send.mockRejectedValue(new MailboxUnavailableError());

        await mailbox.send(session('alice'), conversation, 'hello', {});

        await expect(
          mailbox.queuedMessages(session('alice'), conversationId),
        ).resolves.toEqual([
          expect.objectContaining({ id: 'message-1', text: 'decrypted' }),
        ]);

        mailbox.stopOutbox('alice');
      });

      it('projects no queued send once the peer inbox accepts it', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

        await mailbox.send(session('alice'), conversation, 'hello', {});
        await outboxSettled(mailbox, 'alice');

        await expect(
          mailbox.queuedMessages(session('alice'), conversationId),
        ).resolves.toEqual([]);
      });

      it('resumes a send stopped at logout once the identity unlocks', async () => {
        const alice = withSealedRoot(session('alice'));
        const first = setup();
        first.channel.send.mockRejectedValue(new MailboxUnavailableError());

        await first.mailbox.send(alice, conversation, 'hello', {});
        first.mailbox.stopOutbox('alice');

        const second = setup();
        second.channel.send.mockResolvedValue({
          cursor: 1,
          envelopeId: 'envelope-1',
        });
        await second.mailbox.resumeOutbox(alice);
        await outboxSettled(second.mailbox, 'alice');

        expect(second.channel.send).toHaveBeenCalled();
        expect(second.mailbox.outboxItems('alice', conversationId)).toEqual([]);
      });

      it('wipes the queued sends of a forgotten identity', async () => {
        const alice = withSealedRoot(session('alice'));
        const first = setup();
        first.channel.send.mockRejectedValue(new MailboxUnavailableError());

        await first.mailbox.send(alice, conversation, 'hello', {});
        await first.mailbox.cancelOutbox('alice');

        const second = setup();
        second.channel.send.mockResolvedValue({
          cursor: 1,
          envelopeId: 'envelope-1',
        });
        await second.mailbox.resumeOutbox(alice);

        expect(second.mailbox.outboxItems('alice', conversationId)).toEqual([]);
        expect(second.channel.send).not.toHaveBeenCalled();
      });
    });

    describe('real encrypted payloads', () => {
      const mebibyte = 1024 * 1024;
      const chunkBytes = 8 * mebibyte;
      const conversationKey = SymmetricKey.fromBase64(
        sharedSecret.toString('base64'),
      );

      const encryptPayload = (body: Record<string, unknown>): string =>
        conversationKey
          .encrypt(
            JSON.stringify({
              authorIdentityId: 'alice',
              conversationId,
              timestamp: 100,
              ...body,
            }),
          )
          .toString();

      const decryptPayload = (encryptedPayload: string): unknown =>
        JSON.parse(
          conversationKey
            .decrypt(new EncryptedPayload(encryptedPayload))
            .toString(),
        );

      /** Uploader metadata: blob references and per-part keys, never bytes. */
      const attachmentOf = (size: number) => {
        const parts = Math.ceil(size / chunkBytes);
        const iv = Buffer.alloc(12, 1).toString('base64');

        return {
          blobs: Array.from({ length: parts }, (_, index) => ({
            blobId: `blob-${index}`,
            downloadToken: 'd'.repeat(43),
            expiresAt: 1_700_000_000_000,
            index,
            size: Math.min(chunkBytes, size - index * chunkBytes),
          })),
          contentType: 'application/pdf',
          encrypted: true,
          encryptedSize: size,
          encryption: {
            algorithm: 'AES-GCM',
            chunks: Array.from({ length: parts }, () => ({
              iv,
              size: chunkBytes,
            })),
            chunkSize: chunkBytes,
            iv,
            key: Buffer.alloc(32, 2).toString('base64'),
          },
          filename: 'report.pdf',
          size,
        };
      };

      const sentPayloadOf = (plaintext: Uint8Array): string => {
        const record = DirectMessageMailboxRecord.decode(
          plaintext,
          conversationId,
        );

        if (record?.type !== 'sent') {
          throw new Error('expected a sent record');
        }

        return record.encryptedPayload;
      };

      it('carries an attachment as blob references and keys, not bytes', async () => {
        const { channel, composed, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        const encryptedPayload = encryptPayload({
          attachments: [attachmentOf(20 * mebibyte)],
          content: '',
          type: 'MessageSent',
        });

        composed.sent = { ...sent, encryptedPayload };

        await expect(
          mailbox.send(session('alice'), conversation, 'hello', {}),
        ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));

        const [, plaintext] = channel.send.mock.calls[0];
        expect(
          DirectMessageMailboxRecord.decode(plaintext, conversationId),
        ).toEqual({
          authorId: 'alice',
          conversationId,
          createdAt: 100,
          encryptedPayload,
          id: 'message-1',
          previousMessageIds: ['message-0'],
          type: 'sent',
        });
        expect(decryptPayload(sentPayloadOf(plaintext))).toEqual(
          expect.objectContaining({
            attachments: [attachmentOf(20 * mebibyte)],
            type: 'MessageSent',
          }),
        );
      });

      it('carries a sticker reference in the payload', async () => {
        const { channel, composed, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        const sticker = { id: 'sticker-1', packId: 'pack-1' };
        const encryptedPayload = encryptPayload({
          content: '',
          sticker,
          type: 'StickerMessageSent',
        });

        composed.sent = { ...sent, encryptedPayload };

        await expect(
          mailbox.send(session('alice'), conversation, 'hello', {}),
        ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));

        const [, plaintext] = channel.send.mock.calls[0];
        expect(decryptPayload(sentPayloadOf(plaintext))).toEqual(
          expect.objectContaining({
            sticker,
            type: 'StickerMessageSent',
          }),
        );
      });

      it('rejects an attachment payload over the envelope bound and sends nothing', async () => {
        const { channel, composed, mailbox } = setup();
        const encryptedPayload = encryptPayload({
          attachments: Array.from({ length: 5 }, () =>
            attachmentOf(500 * mebibyte),
          ),
          content: '',
          type: 'MessageSent',
        });
        expect(encryptedPayload.length).toBeGreaterThan(
          MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES,
        );

        composed.sent = { ...sent, encryptedPayload };

        await expect(
          mailbox.send(session('alice'), conversation, 'hello', {}),
        ).rejects.toThrow('envelope bound');
        expect(channel.send).not.toHaveBeenCalled();
      });
    });
  });

  describe('edit', () => {
    it('writes the edit to the recipient mailbox and resolves the projected edit', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      await expect(
        mailbox.edit(session('alice'), conversation, 'message-1', 'edited', {}),
      ).resolves.toEqual(expect.objectContaining({ id: 'edit-1' }));
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(
        expect.objectContaining({
          id: 'edit-1',
          targetMessageId: 'message-1',
          type: 'edited',
        }),
      );
    });
  });

  describe('delete', () => {
    it('writes the delete to the recipient mailbox and resolves', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      await expect(
        mailbox.delete(session('alice'), conversation, 'message-1'),
      ).resolves.toBeUndefined();
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(
        expect.objectContaining({
          authorId: 'alice',
          targetMessageId: 'message-1',
          type: 'deleted',
        }),
      );
    });
  });

  describe('pin', () => {
    it.each(['pin', 'unpin'] as const)(
      'writes a %s record to the mailbox of the peer and resolves',
      async (action) => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

        await expect(
          mailbox.pin(session('alice'), conversation, {
            action,
            createdAt: 700,
            messageId: 'message-1',
          }),
        ).resolves.toBeUndefined();
        const [keys, plaintext] = channel.send.mock.calls[0];
        expect(keys.mailboxId).toBe(keysFor('bob').mailboxId);
        expect(
          DirectMessageMailboxRecord.decode(plaintext, conversationId),
        ).toEqual(
          expect.objectContaining({
            action,
            authorId: 'alice',
            createdAt: 700,
            targetMessageId: 'message-1',
            type: 'pin',
          }),
        );
      },
    );

    it('rejects a pin record that exceeds the envelope bound and sends nothing', async () => {
      const { channel, mailbox } = setup();

      await expect(
        mailbox.pin(session('alice'), conversation, {
          action: 'pin',
          createdAt: 700,
          messageId: 'm'.repeat(MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES),
        }),
      ).rejects.toThrow();
      expect(channel.send).not.toHaveBeenCalled();
    });
  });

  describe('reaction', () => {
    it.each(['add', 'remove'] as const)(
      'writes a %s reaction from bob to the mailbox of alice and resolves',
      async (action) => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

        await expect(
          mailbox.reaction(session('bob'), conversation, {
            ...reaction,
            action,
          }),
        ).resolves.toBeUndefined();
        const [keys, plaintext] = channel.send.mock.calls[0];
        expect(keys.mailboxId).toBe(keysFor('alice').mailboxId);
        expect(
          DirectMessageMailboxRecord.decode(plaintext, conversationId),
        ).toEqual(
          expect.objectContaining({
            action,
            authorId: 'bob',
            emoji: '👍',
            targetMessageId: 'message-1',
            type: 'reaction',
          }),
        );
      },
    );
  });

  describe('markRead', () => {
    it('writes the read receipt to the inbox of this identity and resolves', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      await expect(
        mailbox.markRead(session('alice'), conversation, 'message-1'),
      ).resolves.toBeUndefined();
      const [keys, plaintext] = channel.send.mock.calls[0];
      expect(keys.mailboxId).toBe(keysFor('alice').mailboxId);
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toEqual(
        expect.objectContaining({
          authorId: 'alice',
          targetMessageId: 'message-1',
          type: 'read',
        }),
      );
    });

    it('never rejects when the inbox append fails, and logs count-only', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockRejectedValue(new Error('network down'));
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      await expect(
        mailbox.markRead(session('alice'), conversation, 'message-1'),
      ).resolves.toBeUndefined();
      expect(debug).toHaveBeenCalledTimes(1);
      debug.mockRestore();
    });

    it('sends nothing without a conversation key and never rejects', async () => {
      const { channel, mailbox } = setup();
      const keyless = {
        identity: { id: 'alice' },
        keychain: { conversations: {}, version: 1 },
      } as unknown as Session;

      await expect(
        mailbox.markRead(keyless, conversation, 'message-1'),
      ).resolves.toBeUndefined();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('skips a group conversation and sends nothing', async () => {
      const { channel, mailbox } = setup();
      const group = { ...conversation, type: 'group' } as ConversationResource;

      await expect(
        mailbox.markRead(session('alice'), group, 'message-1'),
      ).resolves.toBeUndefined();
      expect(channel.send).not.toHaveBeenCalled();
    });
  });

  describe.each(deliveries)(
    '%s rejects when the peer copy fails',
    (_label, deliverKind) => {
      it('retries while the recipient inbox is missing, then rejects with MailboxUnavailableError, and logs nothing', async () => {
        jest.useFakeTimers();
        const { channel, mailbox } = setup();
        channel.send.mockRejectedValue(new MailboxUnavailableError());
        const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

        const delivery = expect(
          deliverKind(mailbox, session('alice'), conversation),
        ).rejects.toBeInstanceOf(MailboxUnavailableError);
        await jest.advanceTimersByTimeAsync(60_000);
        await delivery;
        expect(debug).not.toHaveBeenCalled();
        debug.mockRestore();
        jest.useRealTimers();
      });

      it('rejects any other append failure', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockRejectedValue(new Error('network down'));

        await expect(
          deliverKind(mailbox, session('alice'), conversation),
        ).rejects.toThrow('network down');
      });

      it('rejects without a conversation key and sends nothing', async () => {
        const { channel, mailbox } = setup();
        const keyless = {
          identity: { id: 'alice' },
          keychain: { conversations: {}, version: 1 },
        } as unknown as Session;

        await expect(
          deliverKind(mailbox, keyless, conversation),
        ).rejects.toThrow();
        expect(channel.send).not.toHaveBeenCalled();
      });

      it('rejects a group conversation and sends nothing', async () => {
        const { channel, mailbox } = setup();
        const group = {
          ...conversation,
          type: 'group',
        } as ConversationResource;

        await expect(
          deliverKind(mailbox, session('alice'), group),
        ).rejects.toThrow();
        expect(channel.send).not.toHaveBeenCalled();
      });

      it('rejects a message with no peer in the conversation and sends nothing', async () => {
        const { channel, mailbox } = setup();
        const alone = {
          ...conversation,
          participantIds: ['alice'],
        } as ConversationResource;

        await expect(
          deliverKind(mailbox, session('alice'), alone),
        ).rejects.toThrow();
        expect(channel.send).not.toHaveBeenCalled();
      });
    },
  );

  describe('own copy', () => {
    const pinOf = (action: 'pin' | 'unpin') => ({
      action,
      createdAt: 400,
      messageId: 'message-1',
    });
    const everyDelivery: typeof deliveries = [
      sentDelivery,
      ...deliveries,
      ['pin', (mailbox, from, conv) => mailbox.pin(from, conv, pinOf('pin'))],
    ];

    /** The same identity on a second device: its own store, the same node. */
    const otherDevice = (channel: MailboxChannel): DirectMessageMailbox =>
      new DirectMessageMailbox(
        channel,
        new RecipientMailboxRouter(
          channel,
          () => Promise.resolve(undefined),
          () => channel,
        ),
        new DirectMessageMailboxStore(),
        projectionDouble(),
        new DirectMessageReaderSet(channel, (s) =>
          Promise.resolve([credentialFor(s.identity.id)]),
        ),
        composerDouble().composer,
      );

    const appliedOf = (apply: jest.Mock): DirectMessageTimelineChange[] =>
      apply.mock.calls.flatMap(
        ([batch]) => batch as DirectMessageTimelineChange[],
      );

    const envelopeOf = (plaintext: Uint8Array): Record<string, unknown> =>
      JSON.parse(new TextDecoder().decode(plaintext)) as Record<
        string,
        unknown
      >;

    it.each(everyDelivery)(
      'appends the same record to the own inbox after the peer inbox, tagged (%s)',
      async (_label, deliver) => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

        await deliver(mailbox, session('alice'), conversation);
        await outboxSettled(mailbox, 'alice');

        expect(channel.send).toHaveBeenCalledTimes(2);
        const [peerKeys, peerPlaintext] = channel.send.mock.calls[0];
        const [ownKeys, ownPlaintext] = channel.send.mock.calls[1];
        expect(peerKeys.mailboxId).toBe(keysFor('bob').mailboxId);
        expect(ownKeys.mailboxId).toBe(keysFor('alice').mailboxId);
        const { authorTag, ...ownEnvelope } = envelopeOf(ownPlaintext);
        expect(authorTag).toEqual(expect.any(String));
        expect(ownEnvelope).toEqual(envelopeOf(peerPlaintext));
        expect(envelopeOf(peerPlaintext)).not.toHaveProperty('authorTag');
      },
    );

    it('tags the own copy under the device-sealed root, not the master key', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });

      await mailbox.send(
        withSealedRoot(session('alice')),
        conversation,
        'hello',
        {},
      );
      await outboxSettled(mailbox, 'alice');

      const [, ownPlaintext] = channel.send.mock.calls[1];
      const { authorTag, record } = envelopeOf(ownPlaintext);
      expect(authorTag).toBe(
        DirectMessageAuthorship.tag(sealedRoot, record as DirectMessageRecord),
      );
      expect(authorTag).not.toBe(
        DirectMessageAuthorship.tag(
          session('alice').masterKey.getBuffer(),
          record as DirectMessageRecord,
        ),
      );
    });

    it('resolves when the own copy fails, and logs the failure count-only', async () => {
      const { channel, mailbox } = setup();
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
      channel.send
        .mockResolvedValueOnce({ cursor: 1, envelopeId: 'envelope-1' })
        .mockRejectedValueOnce(new Error('own inbox down'));

      await expect(
        mailbox.send(session('alice'), conversation, 'hello', {}),
      ).resolves.toEqual(expect.objectContaining({ id: 'message-1' }));
      await outboxSettled(mailbox, 'alice');
      expect(debug).toHaveBeenCalledTimes(1);
      debug.mockRestore();
    });

    describe('on another device of the same identity', () => {
      it.each<
        [
          string,
          (
            mailbox: DirectMessageMailbox,
            from: Session,
            conv: ConversationResource,
          ) => Promise<unknown>,
          DirectMessageTimelineChange['kind'],
        ]
      >([
        ['sent', (m, f, c) => m.send(f, c, 'hello', {}), 'message'],
        [
          'edited',
          (m, f, c) => m.edit(f, c, 'message-1', 'edited', {}),
          'edit',
        ],
        ['deleted', (m, f, c) => m.delete(f, c, 'message-1'), 'removed'],
        ['reaction', (m, f, c) => m.reaction(f, c, reaction), 'reaction'],
        ['pin', (m, f, c) => m.pin(f, c, pinOf('pin')), 'pin'],
      ])(
        '%s record from the first device reaches the second device',
        async (_label, deliver, kind) => {
          const { channel, mailbox } = setup();
          channel.send.mockResolvedValue({
            cursor: 1,
            envelopeId: 'envelope-1',
          });
          await deliver(mailbox, session('alice'), conversation);
          await outboxSettled(mailbox, 'alice');
          const [, ownPlaintext] = channel.send.mock.calls[1];

          channel.read.mockResolvedValue(pageOf([ownPlaintext]));
          channel.acknowledge.mockResolvedValue({ recreated: false });
          const apply = jest.fn();

          await otherDevice(channel).sync(
            session('alice'),
            conversationId,
            new AbortController().signal,
            apply,
          );

          expect(appliedOf(apply).map((change) => change.kind)).toEqual([kind]);
        },
      );
    });

    it('applies a read receipt from the first device on the second device', async () => {
      const { channel, mailbox } = setup();
      channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
      await mailbox.markRead(session('alice'), conversation, 'message-1');
      const [, ownPlaintext] = channel.send.mock.calls[0];
      channel.read.mockResolvedValue(pageOf([ownPlaintext]));
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await otherDevice(channel).sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(appliedOf(apply).map((change) => change.kind)).toEqual(['read']);
    });

    describe('records a peer writes into the self-inbox as this identity', () => {
      const forgedAsAlice: DirectMessageRecord[] = [
        { ...storedRecord, id: 'forged-sent' },
        {
          authorId: 'alice',
          conversationId,
          createdAt: 200,
          encryptedPayload: 'ciphertext-forged',
          id: 'forged-edit',
          previousMessageIds: ['message-1'],
          targetMessageId: 'message-1',
          type: 'edited',
        },
        {
          authorId: 'alice',
          conversationId,
          createdAt: 200,
          id: 'forged-delete',
          targetMessageId: 'message-1',
          type: 'deleted',
        },
        {
          action: 'add',
          authorId: 'alice',
          conversationId,
          createdAt: 200,
          emoji: '👍',
          id: 'forged-reaction',
          targetMessageId: 'message-1',
          type: 'reaction',
        },
        {
          action: 'pin',
          authorId: 'alice',
          conversationId,
          createdAt: 200,
          id: 'forged-pin',
          targetMessageId: 'message-1',
          type: 'pin',
        },
        {
          authorId: 'alice',
          conversationId,
          createdAt: Date.now(),
          id: 'forged-read',
          targetMessageId: 'message-1',
          type: 'read',
        },
      ];

      it.each(
        forgedAsAlice.map((record): [string, DirectMessageRecord] => [
          record.type,
          record,
        ]),
      )(
        'drops a %s record that a peer wrote as this identity',
        async (_type, record) => {
          const { channel } = setup();
          channel.read.mockResolvedValue(
            pageOf([DirectMessageMailboxRecord.encode(record)]),
          );
          channel.acknowledge.mockResolvedValue({ recreated: false });
          const apply = jest.fn();

          await otherDevice(channel).sync(
            session('alice'),
            conversationId,
            new AbortController().signal,
            apply,
          );

          expect(appliedOf(apply)).toEqual([]);
          expect(channel.acknowledge).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            1,
          );
        },
      );

      it('drops an own copy tagged under the master key once the sealed root replaces it', async () => {
        const { channel } = setup();
        const revokedTag = DirectMessageAuthorship.tag(
          session('alice').masterKey.getBuffer(),
          storedRecord,
        );
        channel.read.mockResolvedValue(
          pageOf([DirectMessageMailboxRecord.encode(storedRecord, revokedTag)]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await otherDevice(channel).sync(
          withSealedRoot(session('alice')),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
      });

      it('applies an own copy tagged under the sealed root', async () => {
        const { channel } = setup();
        const tag = DirectMessageAuthorship.tag(sealedRoot, storedRecord);
        channel.read.mockResolvedValue(
          pageOf([DirectMessageMailboxRecord.encode(storedRecord, tag)]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await otherDevice(channel).sync(
          withSealedRoot(session('alice')),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).not.toEqual([]);
      });

      it('drops a peer copy replayed into the self-inbox', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.send(session('alice'), conversation, 'hello', {});
        const [, peerPlaintext] = channel.send.mock.calls[0];
        channel.read.mockResolvedValue(pageOf([peerPlaintext]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await otherDevice(channel).sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
      });

      it('drops an own copy whose record changed after it was written', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.edit(
          session('alice'),
          conversation,
          'message-1',
          'edited',
          {},
        );
        const [, ownPlaintext] = channel.send.mock.calls[1];
        const envelope = envelopeOf(ownPlaintext);
        (envelope.record as Record<string, unknown>).encryptedPayload =
          'ciphertext-tampered';
        channel.read.mockResolvedValue(
          pageOf([new TextEncoder().encode(JSON.stringify(envelope))]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await otherDevice(channel).sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
      });

      it("drops an own copy the peer wrote under the peer's own root key", async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.send(session('bob'), conversation, 'hello', {});
        await outboxSettled(mailbox, 'bob');
        const [, bobOwnCopy] = channel.send.mock.calls[1];
        channel.read.mockResolvedValue(pageOf([bobOwnCopy]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await otherDevice(channel).sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
      });
    });

    describe('on the sending device', () => {
      it('does not re-apply its own sent record when the inbox replays it', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.send(session('alice'), conversation, 'hello', {});
        await outboxSettled(mailbox, 'alice');
        const [, ownPlaintext] = channel.send.mock.calls[1];
        channel.read.mockResolvedValue(pageOf([ownPlaintext]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
        expect(channel.acknowledge).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          1,
        );
      });

      it('does not undo a local delete when its own sent and delete records replay', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.send(session('alice'), conversation, 'hello', {});
        await mailbox.delete(session('alice'), conversation, 'message-1');
        const ownSent = channel.send.mock.calls[1][1];
        const ownDelete = channel.send.mock.calls[3][1];
        channel.read.mockResolvedValue(pageOf([ownSent, ownDelete]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(appliedOf(apply)).toEqual([]);
      });

      it('still applies a peer record that follows its own copies', async () => {
        const { channel, mailbox } = setup();
        channel.send.mockResolvedValue({ cursor: 1, envelopeId: 'envelope-1' });
        await mailbox.send(session('alice'), conversation, 'hello', {});
        await outboxSettled(mailbox, 'alice');
        const [, ownPlaintext] = channel.send.mock.calls[1];
        const fromBob = DirectMessageMailboxRecord.encode({
          ...storedRecord,
          authorId: 'bob',
          id: 'message-2',
        });
        channel.read.mockResolvedValue(pageOf([ownPlaintext, fromBob]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(messageIds(appliedOf(apply))).toEqual(['message-2']);
      });
    });
  });

  describe('never throws', () => {
    const noParticipantList = {
      ...conversation,
      participantIds: undefined,
    } as unknown as ConversationResource;

    it.each(deliveries)(
      '%s rejects instead of throwing when the conversation has no participant list',
      async (_label, deliverKind) => {
        const { channel, mailbox } = setup();
        let delivery: Promise<unknown> | undefined;

        expect(() => {
          delivery = deliverKind(mailbox, session('alice'), noParticipantList);
        }).not.toThrow();
        await expect(delivery).rejects.toThrow();
        expect(channel.send).not.toHaveBeenCalled();
      },
    );

    it('pin rejects instead of throwing when the conversation has no participant list', async () => {
      const { channel, mailbox } = setup();
      let delivery: Promise<unknown> | undefined;

      expect(() => {
        delivery = mailbox.pin(session('alice'), noParticipantList, {
          action: 'pin',
          createdAt: 700,
          messageId: 'message-1',
        });
      }).not.toThrow();
      await expect(delivery).rejects.toThrow();
      expect(channel.send).not.toHaveBeenCalled();
    });

    it('markRead resolves instead of throwing when the session has no identity', async () => {
      const { channel, mailbox } = setup();
      const anonymous = {
        ...session('alice'),
        identity: undefined,
      } as unknown as Session;
      let delivery: Promise<void> | undefined;

      expect(() => {
        delivery = mailbox.markRead(anonymous, conversation, 'message-1');
      }).not.toThrow();
      await expect(delivery).resolves.toBeUndefined();
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
            plaintext: ownEncode(storedRecord),
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
        {
          kind: 'message',
          message: expect.objectContaining({ id: 'message-1' }),
        },
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
      channel.read.mockResolvedValue(pageWith(ownEncode(storedRecord), 1));

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
      channel.read.mockResolvedValue(pageWith(ownEncode(storedRecord), 1));
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
        .mockResolvedValueOnce(pageWith(ownEncode(storedRecord), 1));
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
        {
          kind: 'message',
          message: expect.objectContaining({ id: 'message-1' }),
        },
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
      channel.read.mockResolvedValue(pageWith(ownEncode(storedRecord), 1));
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

  describe('sync changes', () => {
    const editRecord: DirectEditedRecord = {
      authorId: 'alice',
      conversationId,
      createdAt: 200,
      encryptedPayload: 'ciphertext-2',
      id: 'edit-1',
      previousMessageIds: ['message-1'],
      targetMessageId: 'message-1',
      type: 'edited',
    };
    const deleteRecord: DirectDeletedRecord = {
      authorId: 'alice',
      conversationId,
      createdAt: 400,
      id: 'delete-1',
      targetMessageId: 'message-1',
      type: 'deleted',
    };
    const reactionRecord: DirectReactionRecord = {
      action: 'add',
      authorId: 'bob',
      conversationId,
      createdAt: 300,
      emoji: '👍',
      id: 'reaction-1',
      targetMessageId: 'message-1',
      type: 'reaction',
    };
    const reactionChange = {
      action: 'add',
      authorId: 'bob',
      createdAt: 300,
      emoji: '👍',
      kind: 'reaction',
      messageId: 'message-1',
    };

    const pinRecord: DirectPinRecord = {
      action: 'pin',
      authorId: 'alice',
      conversationId,
      createdAt: 500,
      id: 'pin-1',
      targetMessageId: 'message-1',
      type: 'pin',
    };
    const pinChange = {
      action: 'pin',
      createdAt: 500,
      kind: 'pin',
      messageId: 'message-1',
    };

    it.each(['pin', 'unpin'] as const)(
      'applies a %s record as a pin change without decrypting it',
      async (action) => {
        const { channel, mailbox, projection } = setup();
        channel.read.mockResolvedValue(
          pageOf([ownEncode({ ...pinRecord, action })]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(apply).toHaveBeenCalledWith([{ ...pinChange, action }]);
        expect(projection.decryptMany).not.toHaveBeenCalled();
      },
    );

    it('applies an edit as an edit change', async () => {
      const { channel, mailbox } = setup();
      channel.read.mockResolvedValue(pageOf([ownEncode(editRecord)]));
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        { kind: 'edit', message: expect.objectContaining({ id: 'edit-1' }) },
      ]);
    });

    it('applies a delete as a removed change without decrypting it', async () => {
      const { channel, mailbox, projection } = setup();
      channel.read.mockResolvedValue(pageOf([ownEncode(deleteRecord)]));
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        { kind: 'removed', messageId: 'message-1' },
      ]);
      expect(projection.decryptMany).not.toHaveBeenCalled();
    });

    it('applies a reaction as a reaction change', async () => {
      const { channel, mailbox } = setup();
      channel.read.mockResolvedValue(
        pageOf([DirectMessageMailboxRecord.encode(reactionRecord)]),
      );
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([reactionChange]);
    });

    it('applies a sent, a reaction and a delete in envelope order with one decrypt call', async () => {
      const { channel, mailbox, projection } = setup();
      channel.read.mockResolvedValue(
        pageOf([
          ownEncode(storedRecord),
          DirectMessageMailboxRecord.encode(reactionRecord),
          ownEncode(deleteRecord),
        ]),
      );
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        {
          kind: 'message',
          message: expect.objectContaining({ id: 'message-1' }),
        },
        reactionChange,
        { kind: 'removed', messageId: 'message-1' },
      ]);
      expect(projection.decryptMany).toHaveBeenCalledTimes(1);
    });

    it('drops only the change of a sent record that does not decrypt', async () => {
      const { channel, mailbox, projection } = setup();
      projection.decryptMany.mockImplementation((_session, _id, records) =>
        Promise.resolve(
          records.map((record) => ({ ...decrypted(record), encrypted: true })),
        ),
      );
      channel.read.mockResolvedValue(
        pageOf([
          ownEncode(storedRecord),
          DirectMessageMailboxRecord.encode(reactionRecord),
        ]),
      );
      channel.acknowledge.mockResolvedValue({ recreated: false });
      const apply = jest.fn();

      await mailbox.sync(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([reactionChange]);
    });

    describe('read receipts', () => {
      const now = 1_700_000_000_000;
      const DAY_MS = 24 * 60 * 60 * 1000;
      const readOf = (
        overrides: Partial<DirectReadRecord>,
      ): DirectReadRecord => ({
        authorId: 'alice',
        conversationId,
        createdAt: now,
        id: 'read-1',
        targetMessageId: 'message-1',
        type: 'read',
        ...overrides,
      });
      const changesOf = (apply: jest.Mock): DirectMessageTimelineChange[] =>
        apply.mock.calls.flatMap(
          ([changes]) => changes as DirectMessageTimelineChange[],
        );

      beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(now);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('applies a fresh read by this identity as a read change without decrypting it', async () => {
        const { channel, mailbox, projection } = setup();
        channel.read.mockResolvedValue(pageOf([ownEncode(readOf({}))]));
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(apply).toHaveBeenCalledWith([
          { kind: 'read', messageId: 'message-1' },
        ]);
        expect(projection.decryptMany).not.toHaveBeenCalled();
      });

      it('ignores a read authored by another identity and still acknowledges it', async () => {
        const { channel, mailbox } = setup();
        channel.read.mockResolvedValue(
          pageOf([
            DirectMessageMailboxRecord.encode(readOf({ authorId: 'bob' })),
          ]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(changesOf(apply)).toEqual([]);
        expect(channel.acknowledge).toHaveBeenCalled();
      });

      it('ignores a read created more than 14 days ago', async () => {
        const { channel, mailbox } = setup();
        channel.read.mockResolvedValue(
          pageOf([ownEncode(readOf({ createdAt: now - 14 * DAY_MS - 1 }))]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(changesOf(apply)).toEqual([]);
      });

      it('ignores a read more than 30 seconds ahead of this device', async () => {
        const { channel, mailbox } = setup();
        channel.read.mockResolvedValue(
          pageOf([ownEncode(readOf({ createdAt: now + 30_001 }))]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(changesOf(apply)).toEqual([]);
      });

      it('applies reads on the 14 day and 30 second edges', async () => {
        const { channel, mailbox } = setup();
        channel.read.mockResolvedValue(
          pageOf([
            ownEncode(readOf({ createdAt: now - 14 * DAY_MS })),
            ownEncode(readOf({ createdAt: now + 30_000, id: 'read-2' })),
          ]),
        );
        channel.acknowledge.mockResolvedValue({ recreated: false });
        const apply = jest.fn();

        await mailbox.sync(
          session('alice'),
          conversationId,
          new AbortController().signal,
          apply,
        );

        expect(changesOf(apply)).toEqual([
          { kind: 'read', messageId: 'message-1' },
          { kind: 'read', messageId: 'message-1' },
        ]);
      });
    });
  });

  describe('syncReads', () => {
    const now = 1_700_000_000_000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const readOf = (
      overrides: Partial<DirectReadRecord>,
    ): DirectReadRecord => ({
      authorId: 'alice',
      conversationId,
      createdAt: now,
      id: 'read-1',
      targetMessageId: 'message-1',
      type: 'read',
      ...overrides,
    });
    const sentBy = (authorId: string, id: string): Uint8Array => {
      const record: DirectSentRecord = { ...storedRecord, authorId, id };

      return authorId === 'alice'
        ? ownEncode(record)
        : DirectMessageMailboxRecord.encode(record);
    };
    const openedInbox = (store: DirectMessageMailboxStore): void => {
      store.save(keysFor('alice').mailboxId, { cursor: 0 });
    };
    const readCursorOf = (store: DirectMessageMailboxStore): number | null =>
      store.loadReadCursor(keysFor('alice').mailboxId);

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(now);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('applies a read that no peer message follows, without decrypting or acknowledging', async () => {
      const { channel, mailbox, projection, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([sentBy('bob', 'message-2'), ownEncode(readOf({}))]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        { kind: 'read', messageId: 'message-1' },
      ]);
      expect(projection.decryptMany).not.toHaveBeenCalled();
      expect(channel.acknowledge).not.toHaveBeenCalled();
      expect(store.load(keysFor('alice').mailboxId)).toEqual({ cursor: 0 });
      expect(readCursorOf(store)).toBe(2);
    });

    it('does not apply a read that a peer wrote as this identity', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([DirectMessageMailboxRecord.encode(readOf({}))]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
    });

    it('does not apply a read that a later peer message follows', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([ownEncode(readOf({})), sentBy('bob', 'message-2')]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
      expect(readCursorOf(store)).toBe(2);
    });

    it('does not let a sent message of this identity block a read', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([ownEncode(readOf({})), sentBy('alice', 'message-2')]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        { kind: 'read', messageId: 'message-1' },
      ]);
    });

    it('ignores a read authored by another identity', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([
          DirectMessageMailboxRecord.encode(readOf({ authorId: 'bob' })),
        ]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
    });

    it('ignores a read created more than 14 days ago', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockResolvedValue(
        pageOf([ownEncode(readOf({ createdAt: now - 14 * DAY_MS - 1 }))]),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
    });

    it('applies a read from an earlier page when no peer message follows it in the visit', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read
        .mockResolvedValueOnce({
          envelopes: [
            {
              cursor: 1,
              envelopeId: 'envelope-1',
              plaintext: ownEncode(readOf({})),
            },
          ],
          hasMore: true,
          lastCursor: 1,
          recreated: false,
        })
        .mockResolvedValueOnce({
          envelopes: [],
          hasMore: false,
          lastCursor: 1,
          recreated: false,
        });
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).toHaveBeenCalledWith([
        { kind: 'read', messageId: 'message-1' },
      ]);
    });

    it('keeps a read when a peer message on a later page follows it', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read
        .mockResolvedValueOnce({
          envelopes: [
            {
              cursor: 1,
              envelopeId: 'envelope-1',
              plaintext: ownEncode(readOf({})),
            },
          ],
          hasMore: true,
          lastCursor: 1,
          recreated: false,
        })
        .mockResolvedValueOnce({
          envelopes: [
            {
              cursor: 2,
              envelopeId: 'envelope-2',
              plaintext: sentBy('bob', 'message-2'),
            },
          ],
          hasMore: false,
          lastCursor: 2,
          recreated: false,
        });
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
      expect(readCursorOf(store)).toBe(2);
    });

    it('reads at most four pages per visit and applies nothing until the inbox is drained', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      channel.read.mockImplementation((_keys, _readers, after) =>
        Promise.resolve({
          envelopes: [],
          hasMore: true,
          lastCursor: after + 50,
          recreated: false,
        }),
      );
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).toHaveBeenCalledTimes(4);
      expect(apply).not.toHaveBeenCalled();
      expect(readCursorOf(store)).toBe(200);
    });

    it('reads from the stored read cursor, not the shared sync cursor', async () => {
      const { channel, mailbox, store } = setup();
      store.save(keysFor('alice').mailboxId, { cursor: 5 });
      store.saveReadCursor(keysFor('alice').mailboxId, 7);
      channel.read.mockResolvedValue({
        envelopes: [],
        hasMore: false,
        lastCursor: 7,
        recreated: false,
      });

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        jest.fn(),
      );

      expect(channel.read).toHaveBeenCalledWith(
        keysFor('alice'),
        expect.anything(),
        7,
        50,
      );
      expect(store.load(keysFor('alice').mailboxId)).toEqual({ cursor: 5 });
    });

    it('re-reads from zero when the inbox was re-created under the stored read cursor', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      store.saveReadCursor(keysFor('alice').mailboxId, 30);
      channel.read
        .mockResolvedValueOnce({
          envelopes: [],
          hasMore: false,
          lastCursor: 30,
          recreated: true,
        })
        .mockResolvedValueOnce(pageOf([ownEncode(readOf({}))]));
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).toHaveBeenLastCalledWith(
        keysFor('alice'),
        expect.anything(),
        0,
        50,
      );
      expect(apply).toHaveBeenCalledWith([
        { kind: 'read', messageId: 'message-1' },
      ]);
    });

    it('reads nothing and creates no inbox before the inbox is open on this device', async () => {
      const { channel, mailbox } = setup();
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).not.toHaveBeenCalled();
      expect(channel.createInbox).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    });

    it('leaves a stored legacy inbox to the sync path', async () => {
      const { channel, mailbox, store } = setup();
      store.save(keysFor('alice').mailboxId, {
        cursor: 0,
        readToken: 'legacy-token',
      });
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(channel.read).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    });

    it('reads nothing when the signal is already aborted', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      const controller = new AbortController();
      controller.abort();
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        controller.signal,
        apply,
      );

      expect(channel.read).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    });

    it('applies nothing and keeps the read cursor when aborted during the read', async () => {
      const { channel, mailbox, store } = setup();
      openedInbox(store);
      const controller = new AbortController();
      channel.read.mockImplementation(() => {
        controller.abort();

        return Promise.resolve(pageOf([ownEncode(readOf({}))]));
      });
      const apply = jest.fn();

      await mailbox.syncReads(
        session('alice'),
        conversationId,
        controller.signal,
        apply,
      );

      expect(apply).not.toHaveBeenCalled();
      expect(readCursorOf(store)).toBeNull();
    });
  });

  describe('releaseDeviceReaders', () => {
    it('removes this device reader from the inbox with the root token', async () => {
      const { channel, mailbox } = setup();
      const keys = keysFor('alice');
      const tokens = readerTokensFor('alice', keys.mailboxId);

      await mailbox.releaseDeviceReaders(session('alice'));

      expect(channel.removeReader).toHaveBeenCalledTimes(1);
      expect(channel.removeReader).toHaveBeenCalledWith(
        keys,
        tokens.root,
        MailboxCapability.hash(tokens.device),
      );
    });

    it('keeps releasing the other inboxes when one removal fails, and never throws', async () => {
      const { channel, mailbox } = setup();
      const secondSecret = Buffer.alloc(32, 8);
      const alice = session('alice');
      const secondKeys = MailboxKeySchedule.derive(secondSecret, 'alice', 0);
      const secondTokens = readerTokensFor('alice', secondKeys.mailboxId);
      const withSecond = {
        ...alice,
        keychain: {
          conversations: {
            ...alice.keychain.conversations,
            'conversation-2': {
              ...alice.keychain.conversations[conversationId],
              conversationId: 'conversation-2',
              key: secondSecret.toString('base64'),
            },
          },
          version: 2,
        },
      } as unknown as Session;

      channel.removeReader.mockRejectedValueOnce(
        new HttpJsonError(404, 'Not Found', ''),
      );

      await expect(
        mailbox.releaseDeviceReaders(withSecond),
      ).resolves.toBeUndefined();

      expect(channel.removeReader).toHaveBeenCalledTimes(2);
      expect(channel.removeReader).toHaveBeenLastCalledWith(
        secondKeys,
        secondTokens.root,
        MailboxCapability.hash(secondTokens.device),
      );
    });
  });

  describe('openInboxes', () => {
    const oneToOne = (id: string): ConversationResource =>
      ({
        id,
        participantIds: ['alice', 'bob'],
        type: 'one-to-one',
      }) as unknown as ConversationResource;

    const groupOf = (id: string): ConversationResource =>
      ({
        id,
        participantIds: ['alice', 'bob', 'carol'],
        type: 'group',
      }) as unknown as ConversationResource;

    /** Alice holds a conversation key for each listed id, in order. */
    const sessionWithKeys = (conversationIds: readonly string[]): Session =>
      ({
        ...session('alice'),
        keychain: {
          conversations: Object.fromEntries(
            conversationIds.map((id, index) => [
              id,
              {
                algorithm: 'aes-256-gcm',
                conversationId: id,
                createdAt: 1,
                key: Buffer.alloc(32, 11 + index).toString('base64'),
                kind: 'conversation',
                peerIdentityId: 'bob',
                version: 2,
              },
            ]),
          ),
          version: 1,
        },
      }) as unknown as Session;

    const mailboxIdOf = (index: number): string =>
      MailboxKeySchedule.derive(Buffer.alloc(32, 11 + index), 'alice', 0)
        .mailboxId;

    it('opens every one-to-one inbox this identity holds a key for, without reading', async () => {
      const { channel, mailbox, store } = setup();

      await expect(
        mailbox.openInboxes(
          sessionWithKeys(['conversation-1', 'conversation-2', 'group-1']),
          [
            oneToOne('conversation-1'),
            groupOf('group-1'),
            oneToOne('conversation-2'),
            oneToOne('conversation-3'),
          ],
          new AbortController().signal,
        ),
      ).resolves.toBe(true);

      expect(
        channel.createInbox.mock.calls.map(([keys]) => keys.mailboxId),
      ).toEqual([mailboxIdOf(0), mailboxIdOf(1)]);
      expect(channel.addReader).toHaveBeenCalledTimes(2);
      expect(channel.read).not.toHaveBeenCalled();
      expect(store.load(mailboxIdOf(0))).toEqual({ cursor: 0 });
      expect(store.load(mailboxIdOf(1))).toEqual({ cursor: 0 });
    });

    it('leaves an inbox that is already open alone', async () => {
      const { channel, mailbox, store } = setup();
      store.save(mailboxIdOf(0), { cursor: 4 });

      await expect(
        mailbox.openInboxes(
          sessionWithKeys(['conversation-1', 'conversation-2']),
          [oneToOne('conversation-1'), oneToOne('conversation-2')],
          new AbortController().signal,
        ),
      ).resolves.toBe(true);

      expect(
        channel.createInbox.mock.calls.map(([keys]) => keys.mailboxId),
      ).toEqual([mailboxIdOf(1)]);
      expect(store.load(mailboxIdOf(0))).toEqual({ cursor: 4 });
    });

    it('opens one inbox at a time', async () => {
      const { channel, mailbox } = setup();
      let inFlight = 0;
      let peak = 0;
      channel.createInbox.mockImplementation(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
      });

      await mailbox.openInboxes(
        sessionWithKeys(['conversation-1', 'conversation-2']),
        [oneToOne('conversation-1'), oneToOne('conversation-2')],
        new AbortController().signal,
      );

      expect(channel.createInbox).toHaveBeenCalledTimes(2);
      expect(peak).toBe(1);
    });

    it('retries a failed open only after the retry window, and stores nothing until it succeeds', async () => {
      jest.useFakeTimers();
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      try {
        const { channel, mailbox, store } = setup();
        channel.createInbox.mockRejectedValueOnce(
          new Error('creation refused'),
        );
        const alice = sessionWithKeys(['conversation-1']);
        const conversations = [oneToOne('conversation-1')];

        await expect(
          mailbox.openInboxes(
            alice,
            conversations,
            new AbortController().signal,
          ),
        ).resolves.toBe(false);
        expect(store.load(mailboxIdOf(0))).toBeNull();

        await expect(
          mailbox.openInboxes(
            alice,
            conversations,
            new AbortController().signal,
          ),
        ).resolves.toBe(false);
        expect(channel.createInbox).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60_000);

        await expect(
          mailbox.openInboxes(
            alice,
            conversations,
            new AbortController().signal,
          ),
        ).resolves.toBe(true);
        expect(channel.createInbox).toHaveBeenCalledTimes(2);
        expect(store.load(mailboxIdOf(0))).toEqual({ cursor: 0 });
      } finally {
        debug.mockRestore();
        jest.useRealTimers();
      }
    });

    it('stops at the first rate-limit response and reports the pass incomplete', async () => {
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      try {
        const { channel, mailbox } = setup();
        channel.createInbox.mockRejectedValueOnce(
          new HttpJsonError(429, 'Too Many Requests', 'rate limited'),
        );

        await expect(
          mailbox.openInboxes(
            sessionWithKeys(['conversation-1', 'conversation-2']),
            [oneToOne('conversation-1'), oneToOne('conversation-2')],
            new AbortController().signal,
          ),
        ).resolves.toBe(false);
        expect(channel.createInbox).toHaveBeenCalledTimes(1);
      } finally {
        debug.mockRestore();
      }
    });

    it('carries on past a failed open that is not rate limited', async () => {
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

      try {
        const { channel, mailbox, store } = setup();
        channel.createInbox.mockRejectedValueOnce(
          new Error('creation refused'),
        );

        await expect(
          mailbox.openInboxes(
            sessionWithKeys(['conversation-1', 'conversation-2']),
            [oneToOne('conversation-1'), oneToOne('conversation-2')],
            new AbortController().signal,
          ),
        ).resolves.toBe(false);
        expect(
          channel.createInbox.mock.calls.map(([keys]) => keys.mailboxId),
        ).toEqual([mailboxIdOf(0), mailboxIdOf(1)]);
        expect(store.load(mailboxIdOf(1))).toEqual({ cursor: 0 });
      } finally {
        debug.mockRestore();
      }
    });

    it('stops between conversations once the signal is aborted', async () => {
      const { channel, mailbox } = setup();
      const controller = new AbortController();
      channel.createInbox.mockImplementation(() => {
        controller.abort();

        return Promise.resolve();
      });

      await mailbox.openInboxes(
        sessionWithKeys(['conversation-1', 'conversation-2']),
        [oneToOne('conversation-1'), oneToOne('conversation-2')],
        controller.signal,
      );

      expect(channel.createInbox).toHaveBeenCalledTimes(1);
    });
  });

  describe('over the real channel', () => {
    /**
     * Mirrors the node: the inbox keeps the hash of every reader token with
     * the cursor that reader has acknowledged. An envelope is kept until the
     * slowest reader has acknowledged it, and reads or acknowledgements need a
     * token whose hash is registered. Only the recipient's inbox exists here:
     * writes to any other mailbox, such as the sender's own inbox that was
     * never opened, are unavailable, as on the node.
     */
    const nodeMailboxClient = (
      createGate?: Promise<void>,
      options: {
        maxReaders?: number;
        readerTokens?: readonly string[];
        refusedReaders?: readonly string[];
      } = {},
    ) => {
      const maxReaders = options.maxReaders ?? 8;
      const refused = new Set(
        (options.refusedReaders ?? []).map((token) =>
          MailboxCapability.hash(token),
        ),
      );
      let present = true;
      const recipientInboxId = keysFor('bob').mailboxId;
      let creates = 0;
      let nextCursor = 1;
      let envelopes: { body: string; cursor: number; envelopeId: string }[] =
        [];
      const readers = new Map<string, number>();
      for (const token of options.readerTokens ?? []) {
        readers.set(MailboxCapability.hash(token), 0);
      }
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
          maxReaders,
          readers: Array.from(readers, ([readTokenHash, ackedCursor]) => ({
            ackedCursor,
            readTokenHash,
          })),
        });
      });
      wire.addReader.mockImplementation(
        (_mailboxId, readToken, readTokenHash) => {
          requireReader(readToken);

          if (refused.has(readTokenHash)) {
            return Promise.reject(
              new HttpJsonError(503, 'Service Unavailable', 'refused'),
            );
          }

          if (!readers.has(readTokenHash)) {
            if (readers.size >= maxReaders) {
              return Promise.reject(
                new HttpJsonError(409, 'Conflict', 'reader limit reached'),
              );
            }

            readers.set(readTokenHash, 0);
          }

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
      wire.append.mockImplementation((mailboxId, _postToken, input) => {
        if (!present || mailboxId !== recipientInboxId) {
          throw new MailboxUnavailableError();
        }
        // The node answers a retained envelope id with its existing cursor.
        const known = envelopes.find(
          (envelope) => envelope.envelopeId === input.envelopeId,
        );

        if (known) {
          return Promise.resolve({ cursor: known.cursor });
        }

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
        readerHashes: () => Array.from(readers.keys()),
        wire,
      };
    };

    const mailboxFor = (
      wire: PigeonMailboxClient,
      store: DirectMessageMailboxStore,
      projection: Pick<MessageProjectionPort, 'decrypt' | 'decryptMany'>,
      catalog: readonly string[] = [credentialFor('bob')],
      composed: ComposedRecords = composedRecords(),
    ): DirectMessageMailbox => {
      const channel = new MailboxChannel(wire, jest.fn());
      const readerSet = new DirectMessageReaderSet(channel, () =>
        Promise.resolve(catalog),
      );

      return new DirectMessageMailbox(
        channel,
        new RecipientMailboxRouter(
          channel,
          () => Promise.resolve(undefined),
          () => channel,
        ),
        store,
        projection,
        readerSet,
        composerDouble(composed).composer,
      );
    };

    const hashed = (...tokens: string[]): string[] =>
      tokens.map((token) => MailboxCapability.hash(token)).sort();

    const deviceTokensFor = (
      mailboxId: string,
      credentials: readonly string[],
    ): string[] =>
      credentials.map((credential) =>
        MailboxReadToken.deriveDevice(
          Buffer.alloc(32, 9),
          mailboxId,
          credential,
        ),
      );

    /** The sealed root a device-sealed session reads with. */
    const SEALED_ROOT = Buffer.alloc(32, 5);

    const sealedSessionFor = (
      identityId: string,
      credential = credentialFor(identityId),
    ): Session =>
      ({
        ...deviceSession(identityId, credential),
        deviceSealedRootKey: SymmetricKey.fromBuffer(SEALED_ROOT),
      }) as unknown as Session;

    const syncPass = async (
      mailbox: DirectMessageMailbox,
      sessionUnderTest: Session,
      apply: (changes: DirectMessageTimelineChange[]) => void,
    ): Promise<void> => {
      await mailbox.sync(
        sessionUnderTest,
        conversationId,
        new AbortController().signal,
        apply,
      );
    };

    it('lets a sender deliver once the recipient has opened the inbox, before any read', async () => {
      const { projection, store } = setup();
      const { creates, evict, wire } = nodeMailboxClient();
      evict();
      const mailbox = mailboxFor(wire, store, projection);

      const delivery = mailbox.send(
        session('alice'),
        conversation,
        'hello',
        {},
      );
      await expect(
        mailbox.openInboxes(
          session('bob'),
          [conversation],
          new AbortController().signal,
        ),
      ).resolves.toBe(true);
      await expect(delivery).resolves.toMatchObject({ id: 'message-1' });

      const applied: string[][] = [];
      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        (changes) => {
          applied.push(messageIds(changes));
        },
      );

      expect(applied).toEqual([['message-1']]);
      expect(creates()).toBe(1);
    });

    it('delivers a message once and does not replay it after acknowledgement', async () => {
      const { projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const applied: string[][] = [];
      const recordApplied = (changes: DirectMessageTimelineChange[]) => {
        applied.push(messageIds(changes));
      };

      await expect(
        mailbox.send(session('alice'), conversation, 'hello', {}),
      ).resolves.toMatchObject({ id: 'message-1' });

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

      await mailbox.send(session('alice'), conversation, 'hello', {});
      await mailbox.sync(
        session('bob'),
        conversationId,
        new AbortController().signal,
        (changes) => {
          timeline = MessageCollection.merge(timeline, messagesOf(changes));
        },
      );

      expect(timeline.map((message) => message.id)).toEqual(['message-1']);
    });

    it('delivers after the inbox was evicted and re-created under a stored cursor', async () => {
      const { projection, store } = setup();
      const { evict, wire } = nodeMailboxClient();
      const composed = composedRecords();
      const mailbox = mailboxFor(wire, store, projection, undefined, composed);
      const applied: string[][] = [];
      const sync = () =>
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          (changes) => {
            applied.push(messageIds(changes));
          },
        );

      await mailbox.send(session('alice'), conversation, 'hello', {});
      await sync();
      evict();
      await sync();
      composed.sent = { ...sent, id: 'message-2' };
      await mailbox.send(session('alice'), conversation, 'hello', {});
      await sync();

      expect(applied).toEqual([['message-1'], ['message-2']]);
    });

    it('reads the inbox again after the device lost its local storage', async () => {
      const { clearStorage, projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const composed = composedRecords();
      const mailbox = mailboxFor(wire, store, projection, undefined, composed);
      const applied: string[][] = [];
      const sync = () =>
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          (changes) => {
            applied.push(messageIds(changes));
          },
        );

      await sync();
      await mailbox.send(session('alice'), conversation, 'hello', {});
      await sync();
      clearStorage();
      composed.sent = { ...sent, id: 'message-2' };
      await mailbox.send(session('alice'), conversation, 'hello', {});
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

    it('does not reach the wire before an overlapping pass has created the inbox', async () => {
      const { projection, store } = setup();
      let releaseCreate!: (value: void) => void;
      const gate = new Promise<void>((resolve) => {
        releaseCreate = resolve;
      });
      const { creates, wire } = nodeMailboxClient(gate);
      const mailbox = mailboxFor(wire, store, projection);
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

      expect(wire.readers).not.toHaveBeenCalled();
      expect(wire.read).not.toHaveBeenCalled();

      releaseCreate();
      await Promise.all([first, second]);

      expect(creates()).toBe(1);
    });

    it('lets a sender deliver without the recipient root key', async () => {
      const { projection, store } = setup();
      const { wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const sender = session('alice');

      await expect(
        mailbox.send(sender, conversation, 'hello', {}),
      ).resolves.toMatchObject({ id: 'message-1' });
    });

    it('delivers the peer copy when the sender cannot tag its own copy', async () => {
      const { projection, store } = setup();
      const { envelopeCount, wire } = nodeMailboxClient();
      const mailbox = mailboxFor(wire, store, projection);
      const untaggable = {
        ...session('alice'),
        masterKey: undefined,
      } as unknown as Session;

      await expect(
        mailbox.send(untaggable, conversation, 'hello', {}),
      ).resolves.toMatchObject({ id: 'message-1' });
      expect(envelopeCount()).toBe(1);
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
      const recordInto =
        (applied: string[][]) => (changes: DirectMessageTimelineChange[]) => {
          applied.push(messageIds(changes));
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
      await sender.send(session('alice'), conversation, 'hello', {});
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

    it('frees dead reader slots from a full legacy inbox before adopting it', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const sealedRoot = MailboxReadToken.derive(SEALED_ROOT, keys.mailboxId);
      const sealedDevice = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        credentialFor('bob'),
      );
      const legacy = 'legacy-read-token';
      const dead = Array.from(
        { length: 7 },
        (_, index) => `removed-device-${index}`,
      );
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        maxReaders: 8,
        readerTokens: [legacy, ...dead],
      });
      const sender = mailboxFor(wire, memoryStore(), projection);
      const mailbox = mailboxFor(wire, store, projection);
      const applied: string[][] = [];
      const recordApplied = (changes: DirectMessageTimelineChange[]) => {
        applied.push(messageIds(changes));
      };
      store.save(keys.mailboxId, { cursor: 0, readToken: legacy });

      await expect(
        syncPass(mailbox, sealedSessionFor('bob'), recordApplied),
      ).resolves.toBeUndefined();

      expect(readerHashes().sort()).toEqual(hashed(sealedRoot, sealedDevice));
      expect(store.load(keys.mailboxId)).toEqual({ cursor: 0 });

      await sender.send(session('alice'), conversation, 'hello', {});
      await syncPass(mailbox, sealedSessionFor('bob'), recordApplied);

      expect(applied).toEqual([['message-1']]);
    });

    it('keeps the legacy state and surfaces the cap when no reader can be freed', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const legacy = 'legacy-read-token';
      const devices = Array.from(
        { length: 7 },
        (_, index) => `credential-${index}`,
      );
      const deviceTokens = deviceTokensFor(keys.mailboxId, devices);
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        maxReaders: 8,
        readerTokens: [legacy, ...deviceTokens],
      });
      const mailbox = mailboxFor(wire, store, projection, [
        credentialFor('bob'),
        ...devices,
      ]);
      store.save(keys.mailboxId, { cursor: 0, readToken: legacy });

      await expect(
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          jest.fn(),
        ),
      ).rejects.toMatchObject({ status: 409 });

      expect(store.load(keys.mailboxId)).toEqual({
        cursor: 0,
        readToken: legacy,
      });
      expect(readerHashes().sort()).toEqual(hashed(legacy, ...deviceTokens));
    });

    it('keeps a removed device reader under a masterKey-only session', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const tokens = readerTokensFor('bob', keys.mailboxId);
      const { readerHashes, wire } = nodeMailboxClient();
      await syncPass(
        mailboxFor(wire, store, projection),
        session('bob'),
        jest.fn(),
      );
      await wire.addReader(
        keys.mailboxId,
        tokens.root,
        MailboxCapability.hash('removed-device'),
      );
      // A new app session starts with an empty reconcile memo.
      await syncPass(
        mailboxFor(wire, store, projection),
        session('bob'),
        jest.fn(),
      );

      expect(readerHashes().sort()).toEqual(
        hashed(tokens.root, tokens.device, 'removed-device'),
      );
    });

    it('prunes a removed device reader once the device is bridged', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const tokens = readerTokensFor('bob', keys.mailboxId);
      const sealedRoot = MailboxReadToken.derive(SEALED_ROOT, keys.mailboxId);
      const sealedDevice = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        credentialFor('bob'),
      );
      const { readerHashes, wire } = nodeMailboxClient();
      await syncPass(
        mailboxFor(wire, store, projection),
        session('bob'),
        jest.fn(),
      );
      await wire.addReader(
        keys.mailboxId,
        tokens.root,
        MailboxCapability.hash('removed-device'),
      );

      await syncPass(
        mailboxFor(wire, store, projection),
        sealedSessionFor('bob'),
        jest.fn(),
      );

      expect(readerHashes().sort()).toEqual(hashed(sealedRoot, sealedDevice));
    });

    it('refuses the enrol at the cap under a masterKey-only session', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const tokens = readerTokensFor('bob', keys.mailboxId);
      const live = Array.from(
        { length: 6 },
        (_, index) => `credential-${index}`,
      );
      const liveTokens = deviceTokensFor(keys.mailboxId, live);
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        maxReaders: 8,
        readerTokens: [tokens.root, 'removed-device', ...liveTokens],
      });
      const mailbox = mailboxFor(wire, store, projection, [
        credentialFor('bob'),
        ...live,
      ]);

      await expect(
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          jest.fn(),
        ),
      ).rejects.toMatchObject({ status: 409 });

      expect(readerHashes().sort()).toEqual(
        hashed(tokens.root, 'removed-device', ...liveTokens),
      );
    });

    it('surfaces the cap refusal when every reader is still a device', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const tokens = readerTokensFor('bob', keys.mailboxId);
      const live = Array.from(
        { length: 7 },
        (_, index) => `credential-${index}`,
      );
      const liveTokens = deviceTokensFor(keys.mailboxId, live);
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        maxReaders: 8,
        readerTokens: [tokens.root, ...liveTokens],
      });
      const mailbox = mailboxFor(wire, store, projection, [
        credentialFor('bob'),
        ...live,
      ]);
      const apply = jest.fn();

      await expect(
        mailbox.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          apply,
        ),
      ).rejects.toMatchObject({ status: 409 });

      expect(apply).not.toHaveBeenCalled();
      // The device reader was never enrolled, so the open is not recorded and
      // a later pass enrols it.
      expect(store.load(keys.mailboxId)).toBeNull();
      expect(readerHashes().sort()).toEqual(hashed(tokens.root, ...liveTokens));
    });

    it('keeps the old inbox readable through the sealed root bridge, then prunes the legacy readers', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const legacy = readerTokensFor('bob', keys.mailboxId);
      const sealedRoot = MailboxReadToken.derive(SEALED_ROOT, keys.mailboxId);
      const sealedDevice = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        credentialFor('bob'),
      );
      const { readerHashes, wire } = nodeMailboxClient();
      const composed = composedRecords();
      const sender = mailboxFor(
        wire,
        memoryStore(),
        projection,
        undefined,
        composed,
      );
      const applied: string[][] = [];
      const recordApplied = (changes: DirectMessageTimelineChange[]) => {
        applied.push(messageIds(changes));
      };
      const second = {
        ...sent,
        id: 'message-2',
        previousMessageIds: ['message-1'],
      };

      // Phase A: the legacy inbox exists with the legacy root and device
      // readers.
      await syncPass(
        mailboxFor(wire, store, projection),
        session('bob'),
        recordApplied,
      );
      expect(readerHashes().sort()).toEqual(hashed(legacy.root, legacy.device));

      await sender.send(session('alice'), conversation, 'hello', {});

      // Phase B: the sealed root bridges in. The envelope written before it
      // stays readable.
      await syncPass(
        mailboxFor(wire, store, projection),
        sealedSessionFor('bob'),
        recordApplied,
      );
      expect(applied).toEqual([['message-1']]);
      expect(readerHashes().sort()).toEqual(hashed(sealedRoot, sealedDevice));

      composed.sent = second;
      await sender.send(session('alice'), conversation, 'hello', {});
      await syncPass(
        mailboxFor(wire, store, projection),
        sealedSessionFor('bob'),
        recordApplied,
      );
      expect(applied).toEqual([['message-1'], ['message-2']]);
    });

    it('reads the old inbox with the legacy device reader when the sealed device reader is refused', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const legacy = readerTokensFor('bob', keys.mailboxId);
      const sealedRoot = MailboxReadToken.derive(SEALED_ROOT, keys.mailboxId);
      const sealedDevice = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        credentialFor('bob'),
      );
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        refusedReaders: [sealedDevice],
      });
      const composed = composedRecords();
      const sender = mailboxFor(
        wire,
        memoryStore(),
        projection,
        undefined,
        composed,
      );
      const applied: string[][] = [];
      const recordApplied = (changes: DirectMessageTimelineChange[]) => {
        applied.push(messageIds(changes));
      };
      const second = {
        ...sent,
        id: 'message-2',
        previousMessageIds: ['message-1'],
      };

      await syncPass(
        mailboxFor(wire, store, projection),
        session('bob'),
        recordApplied,
      );
      await sender.send(session('alice'), conversation, 'hello', {});

      // The sealed root registers, but the sealed device is refused.
      // Reads fall back to the legacy device reader, kept until it bridges.
      await syncPass(
        mailboxFor(wire, store, projection),
        sealedSessionFor('bob'),
        recordApplied,
      );
      expect(applied).toEqual([['message-1']]);
      expect(readerHashes().sort()).toEqual(
        hashed(legacy.root, legacy.device, sealedRoot),
      );

      composed.sent = second;
      await sender.send(session('alice'), conversation, 'hello', {});
      await syncPass(
        mailboxFor(wire, store, projection),
        sealedSessionFor('bob'),
        recordApplied,
      );
      expect(applied).toEqual([['message-1'], ['message-2']]);
    });

    it('keeps legacy readers until every credential is bridged, and keeps a bridged device readable meanwhile', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const legacy = readerTokensFor('bob', keys.mailboxId);
      const laptop = 'device-credential-bob-laptop';
      const catalog = [credentialFor('bob'), laptop];
      const laptopLegacy = MailboxReadToken.deriveDevice(
        Buffer.alloc(32, 9),
        keys.mailboxId,
        laptop,
      );
      const sealedRoot = MailboxReadToken.derive(SEALED_ROOT, keys.mailboxId);
      const sealedPhone = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        credentialFor('bob'),
      );
      const sealedLaptop = MailboxReadToken.deriveDevice(
        SEALED_ROOT,
        keys.mailboxId,
        laptop,
      );
      const { readerHashes, wire } = nodeMailboxClient();
      const composed = composedRecords();
      const sender = mailboxFor(
        wire,
        memoryStore(),
        projection,
        catalog,
        composed,
      );
      const laptopStore = memoryStore();
      const phoneApplied: string[][] = [];
      const laptopApplied: string[][] = [];
      const recordPhone = (changes: DirectMessageTimelineChange[]) => {
        phoneApplied.push(messageIds(changes));
      };
      const recordLaptop = (changes: DirectMessageTimelineChange[]) => {
        laptopApplied.push(messageIds(changes));
      };
      const second = {
        ...sent,
        id: 'message-2',
        previousMessageIds: ['message-1'],
      };

      // The phone opens the legacy inbox. The laptop's reader is added below.
      await syncPass(
        mailboxFor(wire, store, projection, catalog),
        session('bob'),
        recordPhone,
      );
      await wire.addReader(
        keys.mailboxId,
        legacy.root,
        MailboxCapability.hash(laptopLegacy),
      );
      await sender.send(session('alice'), conversation, 'hello', {});

      // The phone bridges. The laptop has no sealed reader, so legacy stays.
      await syncPass(
        mailboxFor(wire, store, projection, catalog),
        sealedSessionFor('bob'),
        recordPhone,
      );
      expect(phoneApplied).toEqual([['message-1']]);
      expect(readerHashes().sort()).toEqual(
        hashed(
          legacy.root,
          legacy.device,
          laptopLegacy,
          sealedRoot,
          sealedPhone,
        ),
      );

      // The laptop has no sealed root. It reads with its legacy reader, and the
      // phone's sealed reader survives its sync.
      await syncPass(
        mailboxFor(wire, laptopStore, projection, catalog),
        deviceSession('bob', laptop),
        recordLaptop,
      );
      expect(laptopApplied).toEqual([['message-1']]);
      expect(readerHashes().sort()).toEqual(
        hashed(
          legacy.root,
          legacy.device,
          laptopLegacy,
          sealedRoot,
          sealedPhone,
        ),
      );

      // The laptop bridges too. Every listed credential now holds a sealed
      // reader, so the legacy readers go.
      composed.sent = second;
      await sender.send(session('alice'), conversation, 'hello', {});
      await syncPass(
        mailboxFor(wire, laptopStore, projection, catalog),
        sealedSessionFor('bob', laptop),
        recordLaptop,
      );
      expect(laptopApplied).toEqual([['message-1'], ['message-2']]);
      expect(readerHashes().sort()).toEqual(
        hashed(sealedRoot, sealedPhone, sealedLaptop),
      );

      await syncPass(
        mailboxFor(wire, store, projection, catalog),
        sealedSessionFor('bob'),
        recordPhone,
      );
      expect(phoneApplied).toEqual([['message-1'], ['message-2']]);
    });

    it('leaves a full legacy inbox unadopted under a masterKey-only session', async () => {
      const { projection, store } = setup();
      const keys = keysFor('bob');
      const legacy = 'legacy-read-token';
      const dead = Array.from(
        { length: 7 },
        (_, index) => `removed-device-${index}`,
      );
      const { readerHashes, wire } = nodeMailboxClient(undefined, {
        maxReaders: 8,
        readerTokens: [legacy, ...dead],
      });
      store.save(keys.mailboxId, { cursor: 0, readToken: legacy });

      await expect(
        mailboxFor(wire, store, projection).sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          jest.fn(),
        ),
      ).rejects.toMatchObject({ status: 409 });

      expect(store.load(keys.mailboxId)).toEqual({
        cursor: 0,
        readToken: legacy,
      });
      expect(readerHashes().sort()).toEqual(hashed(legacy, ...dead));
    });

    describe('retried writes', () => {
      beforeEach(async () => {
        jest.useRealTimers();
        await new DirectMessageOutboxStore().forget('alice');
      });

      afterEach(async () => {
        await new DirectMessageOutboxStore().forget('alice');
      });

      /** Resolves once `check` holds, letting queued work run. */
      const until = async (check: () => boolean): Promise<void> => {
        for (let turn = 0; turn < 500 && !check(); turn += 1) {
          await new Promise<void>((resolve) => {
            globalThis.setTimeout(resolve, 0);
          });
        }

        if (!check()) throw new Error('condition not reached');
      };

      /** Writes per mailbox; a repeated envelope id is stored once. */
      const appendLog = () => {
        const logs = new Map<string, Map<string, number>>();
        const wire = mock<PigeonMailboxClient>();
        wire.append.mockImplementation((mailboxId, _postToken, input) => {
          const log = logs.get(mailboxId) ?? new Map<string, number>();
          logs.set(mailboxId, log);
          const cursor = log.get(input.envelopeId) ?? log.size + 1;
          log.set(input.envelopeId, cursor);

          return Promise.resolve({ cursor });
        });

        return {
          appended: (mailboxId: string) => logs.get(mailboxId)?.size ?? 0,
          wire,
        };
      };

      it('writes the own copy once when a retry follows a failed outbox removal', async () => {
        const { projection, store } = setup();
        const { appended, wire } = appendLog();
        const remove = jest
          .spyOn(DirectMessageOutboxStore.prototype, 'remove')
          .mockRejectedValueOnce(new Error('outbox removal failed'));
        const mailbox = mailboxFor(wire, store, projection);

        await mailbox.send(session('alice'), conversation, 'hello', {});
        await until(() =>
          mailbox
            .outboxItems('alice', conversationId)
            .some((item) => item.state === 'failed'),
        );
        remove.mockRestore();
        await mailbox.retry(session('alice'), conversation, 'message-1');
        await until(
          () => mailbox.outboxItems('alice', conversationId).length === 0,
        );

        expect(appended(keysFor('alice').mailboxId)).toBe(1);
        expect(appended(keysFor('bob').mailboxId)).toBe(1);
      });

      it('delivers the peer copy once when a reload resumes a send whose peer write was not saved', async () => {
        const alice = withSealedRoot(session('alice'));
        const { projection, store } = setup();
        const { envelopeCount, wire } = nodeMailboxClient();
        const save = DirectMessageOutboxStore.prototype.save;
        // The page closes before the peer copy is recorded as delivered.
        const stalled = jest
          .spyOn(DirectMessageOutboxStore.prototype, 'save')
          .mockImplementation(function (
            this: DirectMessageOutboxStore,
            owner,
            row,
          ) {
            return row.peerDelivered
              ? new Promise<void>(() => undefined)
              : save.call(this, owner, row);
          });
        const first = mailboxFor(wire, store, projection);

        await first.send(alice, conversation, 'hello', {});
        await until(() => envelopeCount() === 1);
        first.stopOutbox('alice');
        stalled.mockRestore();

        const reloaded = mailboxFor(wire, store, projection);
        await reloaded.resumeOutbox(alice);
        await until(
          () => reloaded.outboxItems('alice', conversationId).length === 0,
        );

        expect(envelopeCount()).toBe(1);

        let timeline: ChatMessage[] = [];
        await reloaded.sync(
          session('bob'),
          conversationId,
          new AbortController().signal,
          (changes) => {
            timeline = MessageCollection.merge(timeline, messagesOf(changes));
          },
        );

        expect(timeline.map((message) => message.id)).toEqual(['message-1']);
      });
    });
  });

  describe('restore', () => {
    const reactionAt = (
      action: 'add' | 'remove',
      id: string,
    ): DirectReactionRecord => ({
      action,
      authorId: 'alice',
      conversationId,
      createdAt: 300,
      emoji: '👍',
      id,
      targetMessageId: 'message-1',
      type: 'reaction',
    });

    /** Own copy tagged under the device-sealed root. */
    const ownSealedEncode = (record: DirectMessageRecord): Uint8Array =>
      DirectMessageMailboxRecord.encode(
        record,
        DirectMessageAuthorship.tag(sealedRoot, record),
      );

    beforeEach(async () => {
      await new DirectMessageHistoryStore().forget('alice');
    });

    it('restores a re-added reaction as a second add and skips a replayed envelope', async () => {
      const { channel, mailbox } = setup();
      channel.acknowledge.mockResolvedValue({ recreated: false });
      channel.read.mockResolvedValue({
        envelopes: [
          {
            cursor: 1,
            envelopeId: 'envelope-1',
            plaintext: ownSealedEncode(reactionAt('add', 'reaction-add-1')),
          },
          {
            cursor: 2,
            envelopeId: 'envelope-2',
            plaintext: ownSealedEncode(
              reactionAt('remove', 'reaction-remove-1'),
            ),
          },
          {
            cursor: 3,
            envelopeId: 'envelope-3',
            plaintext: ownSealedEncode(reactionAt('add', 'reaction-add-2')),
          },
          {
            // A replay of the first add under a new envelope.
            cursor: 4,
            envelopeId: 'envelope-4',
            plaintext: ownSealedEncode(reactionAt('add', 'reaction-add-1')),
          },
        ],
        hasMore: false,
        lastCursor: 4,
        recreated: false,
      });

      await mailbox.sync(
        withSealedRoot(session('alice')),
        conversationId,
        new AbortController().signal,
        jest.fn<void, [DirectMessageTimelineChange[]]>(),
      );

      const apply = jest.fn<void, [DirectMessageTimelineChange[]]>();
      await setup().mailbox.restore(
        withSealedRoot(session('alice')),
        conversationId,
        new AbortController().signal,
        apply,
      );

      expect(apply.mock.calls.flatMap(([batch]) => batch)).toEqual([
        expect.objectContaining({ action: 'add', kind: 'reaction' }),
        expect.objectContaining({ action: 'remove', kind: 'reaction' }),
        expect.objectContaining({ action: 'add', kind: 'reaction' }),
      ]);
    });
  });

  describe('hintTarget', () => {
    it('names the own inbox and its device read token without touching the node', () => {
      const { channel, mailbox, store } = setup();
      const keys = keysFor('bob');
      store.save(keys.mailboxId, { cursor: 0 });

      expect(mailbox.hintTarget(session('bob'), conversationId)).toEqual({
        mailboxId: keys.mailboxId,
        readToken: readerTokensFor('bob', keys.mailboxId).device,
      });
      expect(channel.read).not.toHaveBeenCalled();
      expect(channel.createInbox).not.toHaveBeenCalled();
    });

    it('returns null when the conversation key is not in the keychain', () => {
      const { mailbox } = setup();
      const keyless = {
        ...session('bob'),
        keychain: { conversations: {}, version: 1 },
      } as unknown as Session;

      expect(mailbox.hintTarget(keyless, conversationId)).toBeNull();
    });

    it('returns null until the inbox is open on this device', () => {
      const { mailbox } = setup();

      expect(mailbox.hintTarget(session('bob'), conversationId)).toBeNull();
    });
  });
});
