import { UUID } from '@haskou/value-objects';

import type { DirectMessageRecord } from '../../../../contexts/mailboxes/domain/DirectMessageRecord';

import { DirectMailboxRecords } from '../../../../contexts/mailboxes/domain/DirectMailboxRecords';

describe(DirectMailboxRecords.name, () => {
  const author = { authorId: 'alice', conversationId: 'conversation-1' };
  const base = { ...author, createdAt: 100, id: 'record-1' };
  const generated = {
    deleted: (): DirectMessageRecord =>
      DirectMailboxRecords.deleted({ ...author, targetMessageId: 'message-1' }),
    pin: (): DirectMessageRecord =>
      DirectMailboxRecords.pin({
        ...author,
        action: 'pin',
        createdAt: 100,
        targetMessageId: 'message-1',
      }),
    reaction: (): DirectMessageRecord =>
      DirectMailboxRecords.reaction({
        ...author,
        action: 'add',
        createdAt: 100,
        emoji: 'thumbs-up',
        targetMessageId: 'message-1',
      }),
    read: (): DirectMessageRecord =>
      DirectMailboxRecords.read({ ...author, targetMessageId: 'message-1' }),
  };
  const records: Record<
    keyof typeof DirectMailboxRecords.TYPE,
    DirectMessageRecord
  > = {
    deleted: generated.deleted(),
    edited: DirectMailboxRecords.edited({
      ...base,
      encryptedPayload: 'ciphertext-2',
      targetMessageId: 'message-1',
    }),
    pin: generated.pin(),
    reaction: generated.reaction(),
    read: generated.read(),
    sent: DirectMailboxRecords.sent({
      ...base,
      encryptedPayload: 'ciphertext-1',
      previousMessageIds: [],
    }),
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['deleted', 'pin', 'reaction', 'read'] as const)(
    'gives each %s record a fresh UUID',
    (type) => {
      const first = generated[type]();
      const second = generated[type]();

      expect(new UUID(first.id).toString()).toBe(first.id);
      expect(second.id).not.toBe(first.id);
    },
  );

  it.each(['deleted', 'read'] as const)(
    'stamps each %s record with the current clock',
    (type) => {
      jest.useFakeTimers().setSystemTime(1_700_000_000_000);

      expect(generated[type]().createdAt).toBe(1_700_000_000_000);
    },
  );

  it.each(['pin', 'reaction'] as const)(
    'keeps the caller clock reading on %s records',
    (type) => {
      expect(records[type].createdAt).toBe(100);
    },
  );

  it('keeps the encoded key order of a generated record', () => {
    expect(Object.keys(records.reaction)).toEqual([
      'action',
      'authorId',
      'conversationId',
      'createdAt',
      'emoji',
      'id',
      'targetMessageId',
      'type',
    ]);
    expect(Object.keys(records.read)).toEqual([
      'authorId',
      'conversationId',
      'createdAt',
      'id',
      'targetMessageId',
      'type',
    ]);
  });

  it('gives each record its own discriminant under the TYPE name', () => {
    for (const type of Object.keys(
      DirectMailboxRecords.TYPE,
    ) as (keyof typeof DirectMailboxRecords.TYPE)[]) {
      expect(records[type].type).toBe(type);
    }
  });

  it('carries a message for sent and edited records', () => {
    expect(DirectMailboxRecords.carriesMessage(records.sent)).toBe(true);
    expect(DirectMailboxRecords.carriesMessage(records.edited)).toBe(true);
  });

  it.each(['deleted', 'pin', 'reaction', 'read'] as const)(
    'carries no message for %s records',
    (type) => {
      expect(DirectMailboxRecords.carriesMessage(records[type])).toBe(false);
    },
  );
});
