import {
  MailboxRecordAuthorship,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';

import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';

import { DirectMessageAuthorship } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageAuthorship';

describe('DirectMessageAuthorship', () => {
  const rootKey = SymmetricKey.fromBuffer(Buffer.alloc(32, 3));
  const record: DirectSentRecord = {
    authorId: 'alice',
    conversationId: 'conversation-1',
    createdAt: 100,
    encryptedPayload: 'ciphertext-1',
    id: 'message-1',
    previousMessageIds: ['message-0'],
    type: 'sent',
  };

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
    const tag = MailboxRecordAuthorship.tag(rootKey, record);

    expect(
      DirectMessageAuthorship.isAuthentic('alice', rootKey, record, tag),
    ).toBe(true);
  });

  it('rejects an own record tagged under another root key', () => {
    const tag = MailboxRecordAuthorship.tag(
      SymmetricKey.fromBuffer(Buffer.alloc(32, 9)),
      record,
    );

    expect(
      DirectMessageAuthorship.isAuthentic('alice', rootKey, record, tag),
    ).toBe(false);
  });

  it('rejects an own record changed after it was tagged', () => {
    const tag = MailboxRecordAuthorship.tag(rootKey, record);

    expect(
      DirectMessageAuthorship.isAuthentic(
        'alice',
        rootKey,
        { ...record, encryptedPayload: 'ciphertext-2' },
        tag,
      ),
    ).toBe(false);
  });

  it('rejects a record whose author id the value object rejects', () => {
    expect(
      DirectMessageAuthorship.isAuthentic(
        'alice',
        rootKey,
        { ...record, authorId: 'x'.repeat(5000) },
        undefined,
      ),
    ).toBe(false);
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
