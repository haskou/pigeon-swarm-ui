import { Buffer } from 'buffer';

import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';

import { DirectMessageAuthorship } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAuthorship';

describe('DirectMessageAuthorship', () => {
  const rootKey = Buffer.alloc(32, 3);
  const record: DirectSentRecord = {
    authorId: 'alice',
    conversationId: 'conversation-1',
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };

  it('verifies a tag made under the same root key', () => {
    const tag = DirectMessageAuthorship.tag(rootKey, record);

    expect(DirectMessageAuthorship.verify(rootKey, record, tag)).toBe(true);
  });

  it('fails to verify under another root key', () => {
    const tag = DirectMessageAuthorship.tag(rootKey, record);

    expect(
      DirectMessageAuthorship.verify(Buffer.alloc(32, 9), record, tag),
    ).toBe(false);
  });

  it('fails to verify after any field changes', () => {
    const tag = DirectMessageAuthorship.tag(rootKey, record);

    expect(
      DirectMessageAuthorship.verify(
        rootKey,
        { ...record, encryptedPayload: 'ciphertext-2' },
        tag,
      ),
    ).toBe(false);
  });

  it('does not depend on property order', () => {
    // Reversed insertion order; the tag must not depend on it.
    const reordered = Object.fromEntries(
      Object.entries(record).reverse(),
    ) as DirectSentRecord;

    expect(DirectMessageAuthorship.tag(rootKey, reordered)).toBe(
      DirectMessageAuthorship.tag(rootKey, record),
    );
  });

  it('rejects a root key that is not 32 bytes', () => {
    expect(() =>
      DirectMessageAuthorship.tag(Buffer.alloc(16, 3), record),
    ).toThrow(new RangeError('Mailbox root key must be 32 bytes'));
  });

  it('accepts a record authored by another identity without a tag', () => {
    expect(
      DirectMessageAuthorship.isAuthentic('bob', rootKey, record, undefined),
    ).toBe(true);
  });

  it('rejects a record authored by this identity without a tag', () => {
    expect(
      DirectMessageAuthorship.isAuthentic('alice', rootKey, record, undefined),
    ).toBe(false);
  });

  it('accepts a record authored by this identity with a valid tag', () => {
    const tag = DirectMessageAuthorship.tag(rootKey, record);

    expect(
      DirectMessageAuthorship.isAuthentic('alice', rootKey, record, tag),
    ).toBe(true);
  });

  it('treats a record whose author id the value object rejects as not own', () => {
    expect(
      DirectMessageAuthorship.isAuthentic(
        'alice',
        rootKey,
        { ...record, authorId: 'x'.repeat(5000) },
        undefined,
      ),
    ).toBe(true);
  });

  it('requires a valid tag on an own record addressed in PEM form', () => {
    expect(
      DirectMessageAuthorship.isAuthentic(
        'alice',
        rootKey,
        {
          ...record,
          authorId:
            '-----BEGIN PUBLIC KEY-----\nalice\n-----END PUBLIC KEY-----\n',
        },
        undefined,
      ),
    ).toBe(false);
  });
});
