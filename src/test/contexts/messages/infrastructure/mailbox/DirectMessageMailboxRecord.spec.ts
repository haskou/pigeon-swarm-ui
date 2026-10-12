import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';
import type {
  DirectDeletedRecord,
  DirectEditedRecord,
  DirectPinRecord,
  DirectReactionRecord,
  DirectReadRecord,
  DirectSentRecord,
} from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';

import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';

describe(DirectMessageMailboxRecord.name, () => {
  const conversationId = 'conversation-1';
  const sentRecord: DirectSentRecord = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };
  const records: {
    deleted: DirectDeletedRecord;
    edited: DirectEditedRecord;
    pin: DirectPinRecord;
    reactionAdd: DirectReactionRecord;
    reactionRemove: DirectReactionRecord;
    sentWithReply: DirectSentRecord;
    unpin: DirectPinRecord;
  } = {
    deleted: {
      authorId: 'alice',
      conversationId,
      createdAt: 400,
      id: 'delete-1',
      targetMessageId: 'message-1',
      type: 'deleted',
    },
    edited: {
      authorId: 'alice',
      conversationId,
      createdAt: 200,
      encryptedPayload: 'ciphertext-2',
      id: 'edit-1',
      previousMessageIds: ['message-1'],
      targetMessageId: 'message-1',
      type: 'edited',
    },
    pin: {
      action: 'pin',
      authorId: 'alice',
      conversationId,
      createdAt: 500,
      id: 'pin-1',
      targetMessageId: 'message-1',
      type: 'pin',
    },
    reactionAdd: {
      action: 'add',
      authorId: 'bob',
      conversationId,
      createdAt: 300,
      emoji: '👍',
      id: 'reaction-1',
      targetMessageId: 'message-1',
      type: 'reaction',
    },
    reactionRemove: {
      action: 'remove',
      authorId: 'bob',
      conversationId,
      createdAt: 301,
      emoji: '👍',
      id: 'reaction-2',
      targetMessageId: 'message-1',
      type: 'reaction',
    },
    sentWithReply: {
      ...sentRecord,
      id: 'message-2',
      replyToMessageId: 'message-1',
    },
    unpin: {
      action: 'unpin',
      authorId: 'alice',
      conversationId,
      createdAt: 501,
      id: 'pin-2',
      targetMessageId: 'message-1',
      type: 'pin',
    },
  };
  const text = (value: string): Uint8Array => new TextEncoder().encode(value);
  const envelope = (record: unknown, version = 2): Uint8Array =>
    text(JSON.stringify({ kind: 'direct-message', record, version }));

  describe('isEligible', () => {
    it('accepts a one-to-one conversation', () => {
      expect(DirectMessageMailboxRecord.isEligible('one-to-one')).toBe(true);
    });

    it('rejects a group conversation', () => {
      expect(DirectMessageMailboxRecord.isEligible('group')).toBe(false);
    });
  });

  describe('fromSent', () => {
    it('maps the legacy resource to a sent record', () => {
      const sent: MessageResource = {
        authorId: 'alice',
        createdAt: 100,
        encryptedPayload: 'ciphertext-1',
        id: 'message-1',
        previousMessageIds: ['message-0'],
        type: 'sent',
      };

      expect(DirectMessageMailboxRecord.fromSent(conversationId, sent)).toEqual(
        sentRecord,
      );
    });

    it('keeps the reply target so the recipient threads the reply', () => {
      expect(
        DirectMessageMailboxRecord.fromSent(conversationId, {
          authorId: 'alice',
          createdAt: 100,
          encryptedPayload: 'ciphertext-1',
          id: 'message-2',
          previousMessageIds: ['message-0'],
          replyToMessageId: 'message-1',
        }),
      ).toEqual(records.sentWithReply);
    });

    it('fails when the resource lacks a mailbox field', () => {
      expect(() =>
        DirectMessageMailboxRecord.fromSent(conversationId, {
          createdAt: 100,
          encryptedPayload: 'ciphertext-1',
          id: 'message-1',
        }),
      ).toThrow('Sent message is missing mailbox fields.');
    });
  });

  describe('fromEdited', () => {
    it('maps the edited resource to an edited record with its target', () => {
      expect(
        DirectMessageMailboxRecord.fromEdited(conversationId, {
          authorId: 'alice',
          createdAt: 200,
          encryptedPayload: 'ciphertext-2',
          id: 'edit-1',
          previousMessageIds: ['message-1'],
          targetMessageId: 'message-1',
          type: 'edited',
        }),
      ).toEqual(records.edited);
    });

    it('fails when the resource lacks its target', () => {
      expect(() =>
        DirectMessageMailboxRecord.fromEdited(conversationId, {
          authorId: 'alice',
          createdAt: 200,
          encryptedPayload: 'ciphertext-2',
          id: 'edit-1',
          type: 'edited',
        }),
      ).toThrow('Edited message is missing mailbox fields.');
    });
  });

  describe('encode and decode', () => {
    it.each(Object.entries(records))(
      'round-trips a %s record of this conversation',
      (_label, record) => {
        expect(
          DirectMessageMailboxRecord.decode(
            DirectMessageMailboxRecord.encode(record),
            conversationId,
          ),
        ).toEqual(record);
      },
    );

    it('round-trips the sent record', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(sentRecord),
          conversationId,
        ),
      ).toEqual(sentRecord);
    });

    it.each([
      ['a sent record', sentRecord],
      ['a deleted record', records.deleted],
      ['a reaction record', records.reactionAdd],
      ['a pin record', records.pin],
    ])('rejects %s that belongs to another conversation', (_label, record) => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(record),
          'conversation-2',
        ),
      ).toBeNull();
    });

    it.each([
      ['non-JSON bytes', text('not json')],
      [
        'another kind',
        text(JSON.stringify({ kind: 'other', record: sentRecord, version: 2 })),
      ],
      ['another version', envelope(sentRecord, 1)],
      [
        'the version 1 direct-text envelope',
        text(
          JSON.stringify({
            kind: 'direct-text',
            record: { ...sentRecord, type: undefined },
            version: 1,
          }),
        ),
      ],
      ['an unknown record type', envelope({ ...sentRecord, type: 'poll' })],
      [
        'a sent record without a payload',
        envelope({ ...sentRecord, encryptedPayload: undefined }),
      ],
      [
        'an edited record without a target',
        envelope({ ...records.edited, targetMessageId: undefined }),
      ],
      [
        'a deleted record without a target',
        envelope({ ...records.deleted, targetMessageId: undefined }),
      ],
      [
        'a reaction with an unknown action',
        envelope({ ...records.reactionAdd, action: 'toggle' }),
      ],
      [
        'a reaction without an emoji',
        envelope({ ...records.reactionAdd, emoji: undefined }),
      ],
      [
        'a pin with an unknown action',
        envelope({ ...records.pin, action: 'toggle' }),
      ],
      [
        'a pin without a target',
        envelope({ ...records.pin, targetMessageId: undefined }),
      ],
    ])('returns null for %s', (_label, plaintext) => {
      expect(
        DirectMessageMailboxRecord.decode(plaintext, conversationId),
      ).toBeNull();
    });
  });

  describe('toResource', () => {
    it('maps a sent record to the resource the projection decrypts', () => {
      expect(
        DirectMessageMailboxRecord.toResource(records.sentWithReply),
      ).toEqual({
        authorId: 'alice',
        conversationId,
        createdAt: 100,
        encryptedPayload: 'ciphertext-1',
        id: 'message-2',
        previousMessageIds: ['message-0'],
        replyToMessageId: 'message-1',
        type: 'sent',
      });
    });

    it('maps an edited record to an edited resource with its target', () => {
      expect(DirectMessageMailboxRecord.toResource(records.edited)).toEqual({
        authorId: 'alice',
        conversationId,
        createdAt: 200,
        encryptedPayload: 'ciphertext-2',
        id: 'edit-1',
        previousMessageIds: ['message-1'],
        targetMessageId: 'message-1',
        type: 'edited',
      });
    });
  });

  describe('read records', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = 1_700_000_000_000;
    const readRecord: DirectReadRecord = {
      authorId: 'alice',
      conversationId,
      createdAt: now,
      id: 'read-1',
      targetMessageId: 'message-1',
      type: 'read',
    };

    it('round-trips a read record of this conversation', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(readRecord),
          conversationId,
        ),
      ).toEqual(readRecord);
    });

    it('rejects a read record that belongs to another conversation', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(readRecord),
          'conversation-2',
        ),
      ).toBeNull();
    });

    it('returns null for a read record without a target', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          envelope({ ...readRecord, targetMessageId: undefined }),
          conversationId,
        ),
      ).toBeNull();
    });

    it.each([
      ['created now', 0, true],
      ['created 14 days ago', -14 * DAY_MS, true],
      ['created 14 days and 1 ms ago', -14 * DAY_MS - 1, false],
      ['created 30 seconds ahead', 30_000, true],
      ['created 30 seconds and 1 ms ahead', 30_001, false],
    ])('judges a read record that was %s fresh=%s', (_label, offset, fresh) => {
      expect(
        DirectMessageMailboxRecord.isFreshReceipt(
          { ...readRecord, createdAt: now + offset },
          now,
        ),
      ).toBe(fresh);
    });
  });
});
