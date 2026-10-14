import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectReadRecord } from '../../../../../contexts/mailboxes/domain/DirectReadRecord';

import type { DirectSentRecord } from '../../../../../contexts/mailboxes/domain/DirectSentRecord';

import { DirectMessageMailboxRecord } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailboxRecord';
import { DirectMessageRecordReader } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageRecordReader';

const OWN_ID = 'MCowBQYDK2VwAyEAown';
const session = {
  deviceSealedRootKey: { getBuffer: () => Buffer.alloc(32, 3) },
  identity: { id: OWN_ID },
} as unknown as Session;
const sent = (authorId: string): DirectSentRecord => ({
  authorId,
  conversationId: 'conversation-1',
  createdAt: 100,
  encryptedPayload: 'ciphertext-1',
  id: 'message-1',
  previousMessageIds: [],
  type: 'sent',
});
const read = (authorId: string): DirectReadRecord => ({
  authorId,
  conversationId: 'conversation-1',
  createdAt: Date.now(),
  id: 'read-1',
  targetMessageId: 'message-1',
  type: 'read',
});

describe(DirectMessageRecordReader.name, () => {
  it('decodes a peer record', () => {
    expect(
      DirectMessageRecordReader.decode(
        session,
        'conversation-1',
        DirectMessageMailboxRecord.encode(sent('MCowBQYDK2VwAyEApeer')),
      )?.id,
    ).toBe('message-1');
  });

  it('refuses a record whose author id the value object rejects', () => {
    expect(
      DirectMessageRecordReader.decode(
        session,
        'conversation-1',
        DirectMessageMailboxRecord.encode(sent('x'.repeat(5000))),
      ),
    ).toBeNull();
  });

  it('reads an own fresh receipt authored with the own id in PEM form', () => {
    expect(
      DirectMessageRecordReader.isOwnFreshRead(
        session,
        read(
          `-----BEGIN PUBLIC KEY-----\n${OWN_ID}\n-----END PUBLIC KEY-----\n`,
        ),
      ),
    ).toBe(true);
  });

  it('ignores a receipt whose author id the value object rejects', () => {
    expect(
      DirectMessageRecordReader.isOwnFreshRead(session, read('x'.repeat(5000))),
    ).toBe(false);
  });
});
