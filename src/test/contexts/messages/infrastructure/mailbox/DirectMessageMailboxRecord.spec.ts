import type { MessageResource } from '../../../../../contexts/messages/infrastructure/http/MessageResource';

import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';

describe(DirectMessageMailboxRecord.name, () => {
  const conversationId = 'conversation-1';
  const record = {
    authorId: 'alice',
    conversationId,
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
  };
  const text = (value: string): Uint8Array => new TextEncoder().encode(value);

  describe('isEligible', () => {
    const plainDirectText = {
      attachmentCount: 0,
      conversationType: 'one-to-one' as const,
      hasReply: false,
      hasSticker: false,
    };

    it('accepts plain text in a one-to-one conversation', () => {
      expect(DirectMessageMailboxRecord.isEligible(plainDirectText)).toBe(true);
    });

    it.each([
      ['group conversations', { conversationType: 'group' as const }],
      ['attachments', { attachmentCount: 1 }],
      ['replies', { hasReply: true }],
      ['stickers', { hasSticker: true }],
    ])('rejects %s', (_label, override) => {
      expect(
        DirectMessageMailboxRecord.isEligible({
          ...plainDirectText,
          ...override,
        }),
      ).toBe(false);
    });
  });

  describe('fromSent', () => {
    it('maps the legacy resource to the mailbox record', () => {
      const sent: MessageResource = {
        authorId: 'alice',
        createdAt: 100,
        encryptedPayload: 'ciphertext-1',
        id: 'message-1',
        previousMessageIds: ['message-0'],
      };

      expect(DirectMessageMailboxRecord.fromSent(conversationId, sent)).toEqual(
        record,
      );
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

  describe('decode', () => {
    it('returns a sent resource for a record of this conversation', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(record),
          conversationId,
        ),
      ).toEqual({ ...record, type: 'sent' });
    });

    it('rejects a record that belongs to another conversation', () => {
      expect(
        DirectMessageMailboxRecord.decode(
          DirectMessageMailboxRecord.encode(record),
          'conversation-2',
        ),
      ).toBeNull();
    });

    it.each([
      ['non-JSON bytes', text('not json')],
      ['another kind', text(JSON.stringify({ kind: 'other', record, version: 1 }))],
      ['another version', text(JSON.stringify({ kind: 'direct-text', record, version: 2 }))],
      [
        'a record with a missing field',
        text(
          JSON.stringify({
            kind: 'direct-text',
            record: { ...record, encryptedPayload: undefined },
            version: 1,
          }),
        ),
      ],
    ])('returns null for %s', (_label, plaintext) => {
      expect(DirectMessageMailboxRecord.decode(plaintext, conversationId)).toBeNull();
    });
  });
});
