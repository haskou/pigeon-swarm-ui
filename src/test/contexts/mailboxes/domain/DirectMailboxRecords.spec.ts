import type { DirectMessageRecord } from '../../../../contexts/mailboxes/domain/DirectMessageRecord';

import { DirectMailboxRecords } from '../../../../contexts/mailboxes/domain/DirectMailboxRecords';

describe(DirectMailboxRecords.name, () => {
  const base = {
    authorId: 'alice',
    conversationId: 'conversation-1',
    createdAt: 100,
    id: 'record-1',
  };
  const records: Record<
    keyof typeof DirectMailboxRecords.TYPE,
    DirectMessageRecord
  > = {
    deleted: DirectMailboxRecords.deleted({
      ...base,
      targetMessageId: 'message-1',
    }),
    edited: DirectMailboxRecords.edited({
      ...base,
      encryptedPayload: 'ciphertext-2',
      targetMessageId: 'message-1',
    }),
    pin: DirectMailboxRecords.pin({
      ...base,
      action: 'pin',
      targetMessageId: 'message-1',
    }),
    reaction: DirectMailboxRecords.reaction({
      ...base,
      action: 'add',
      emoji: 'thumbs-up',
      targetMessageId: 'message-1',
    }),
    read: DirectMailboxRecords.read({ ...base, targetMessageId: 'message-1' }),
    sent: DirectMailboxRecords.sent({
      ...base,
      encryptedPayload: 'ciphertext-1',
      previousMessageIds: [],
    }),
  };

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
