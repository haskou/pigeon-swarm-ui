import type { GroupMailboxControlFields } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlFields';

import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';

const REQUEST_ID = 'AAAAAAAAAAAAAAAAAAAAAA';
const bytes = new Uint8Array([0, 1, 250, 255]);
const json = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));
const header = {
  conversationId: 'conversation-1',
  kind: 'group-mailbox-control',
  version: 1,
};

describe('GroupMailboxControlRecord', () => {
  it.each<GroupMailboxControlFields>([
    {
      conversationId: 'conversation-1',
      requestId: REQUEST_ID,
      type: 'key-package-request',
    },
    {
      conversationId: 'conversation-1',
      keyPackage: bytes,
      requestId: REQUEST_ID,
      type: 'key-package-response',
    },
    {
      conversationId: 'conversation-1',
      index: 3,
      type: 'welcome',
      welcome: bytes,
    },
    { commit: bytes, conversationId: 'conversation-1', type: 'commit' },
    { ciphertext: bytes, conversationId: 'conversation-1', type: 'message' },
  ])('round-trips a $type record', (fields) => {
    expect(
      GroupMailboxControlRecord.decode(
        GroupMailboxControlRecord.encode(fields),
      ),
    ).toEqual(fields);
  });

  it.each([
    ['text that is not JSON', new TextEncoder().encode('hello')],
    ['JSON null', json(null)],
    [
      'another kind',
      json({ ...header, commit: 'AA', kind: 'other', type: 'commit' }),
    ],
    [
      'another version',
      json({ ...header, commit: 'AA', type: 'commit', version: 2 }),
    ],
    ['an unknown type', json({ ...header, type: 'leave' })],
    [
      'an empty conversation',
      json({ ...header, commit: 'AA', conversationId: '', type: 'commit' }),
    ],
    ['padded base64', json({ ...header, commit: 'AA==', type: 'commit' })],
    ['standard base64', json({ ...header, commit: 'A+/A', type: 'commit' })],
    [
      'a non-canonical encoding',
      json({ ...header, commit: 'AB', type: 'commit' }),
    ],
    ['an empty commit', json({ ...header, commit: '', type: 'commit' })],
    [
      'a short request id',
      json({ ...header, requestId: 'abc', type: 'key-package-request' }),
    ],
    [
      'a negative index',
      json({ ...header, index: -1, type: 'welcome', welcome: 'AA' }),
    ],
    [
      'a fractional index',
      json({ ...header, index: 1.5, type: 'welcome', welcome: 'AA' }),
    ],
    [
      'a string index',
      json({ ...header, index: '1', type: 'welcome', welcome: 'AA' }),
    ],
    [
      'an oversized commit',
      json({ ...header, commit: 'A'.repeat(60_000), type: 'commit' }),
    ],
    ['an empty message', json({ ...header, ciphertext: '', type: 'message' })],
    [
      'an oversized message',
      json({ ...header, ciphertext: 'A'.repeat(60_000), type: 'message' }),
    ],
    [
      'a message without ciphertext',
      json({ ...header, commit: 'AA', type: 'message' }),
    ],
  ])('does not decode %s', (_name, plaintext) => {
    expect(GroupMailboxControlRecord.decode(plaintext)).toBeNull();
  });

  it('never writes the generation secret: a welcome names only the index', () => {
    const decoded = JSON.parse(
      new TextDecoder().decode(
        GroupMailboxControlRecord.encode({
          conversationId: 'conversation-1',
          index: 3,
          type: 'welcome',
          welcome: bytes,
        }),
      ),
    ) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual([
      'conversationId',
      'index',
      'kind',
      'type',
      'version',
      'welcome',
    ]);
  });
});
