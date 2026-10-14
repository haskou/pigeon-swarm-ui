import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectReadRecord } from '../../../../../contexts/mailboxes/domain/DirectReadRecord';

import { DirectMessageRecordReader } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageRecordReader';

const OWN_ID = 'MCowBQYDK2VwAyEAown';
const session = { identity: { id: OWN_ID } } as unknown as Session;
const read = (authorId: string): DirectReadRecord => ({
  authorId,
  conversationId: 'conversation-1',
  createdAt: Date.now(),
  id: 'read-1',
  targetMessageId: 'message-1',
  type: 'read',
});

describe(DirectMessageRecordReader.name, () => {
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
