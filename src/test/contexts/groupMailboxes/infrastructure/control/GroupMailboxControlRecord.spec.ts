import type { GroupMailboxControlFields } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlFields';

import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { GroupMailboxGenesis } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxGenesis';
import { GroupMailboxControlRecord } from '../../../../../contexts/groupMailboxes/infrastructure/control/GroupMailboxControlRecord';

const REQUEST_ID = 'AAAAAAAAAAAAAAAAAAAAAA';
const DEVICE = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAGb9ECWmEzf6FQbrBZ9w7lshQhqowtrbLDFw4rXAxZuE=',
  '-----END PUBLIC KEY-----',
  '',
].join('\n');
const bytes = new Uint8Array([0, 1, 250, 255]);
const json = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value));
const header = {
  conversationId: 'conversation-1',
  kind: 'group-mailbox-control',
  version: 1,
};
const welcome = {
  ...header,
  deviceCredential: DEVICE,
  index: 1,
  type: 'welcome',
  welcome: 'AA',
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
      deviceCredential: DEVICE,
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

  it('round-trips a request that asks one device of the peer', () => {
    const fields: GroupMailboxControlFields = {
      conversationId: 'conversation-1',
      deviceCredential: DEVICE,
      requestId: REQUEST_ID,
      type: 'key-package-request',
    };

    expect(
      GroupMailboxControlRecord.decode(
        GroupMailboxControlRecord.encode(fields),
      ),
    ).toEqual(fields);
  });

  it('does not decode a request naming a malformed device', () => {
    expect(
      GroupMailboxControlRecord.decode(
        json({
          ...header,
          deviceCredential: 'not-a-public-key',
          requestId: REQUEST_ID,
          type: 'key-package-request',
        }),
      ),
    ).toBeNull();
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
    ['a negative index', json({ ...welcome, index: -1 })],
    ['a fractional index', json({ ...welcome, index: 1.5 })],
    ['a string index', json({ ...welcome, index: '1' })],
    [
      'a welcome naming no device',
      json({ ...welcome, deviceCredential: undefined }),
    ],
    [
      'a welcome naming a malformed device',
      json({ ...welcome, deviceCredential: 'not-a-public-key' }),
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
          deviceCredential: DEVICE,
          index: 3,
          type: 'welcome',
          welcome: bytes,
        }),
      ),
    ) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual([
      'conversationId',
      'deviceCredential',
      'index',
      'kind',
      'type',
      'version',
      'welcome',
    ]);
  });

  describe('the genesis of a key package request', () => {
    const genesis = {
      creatorIdentityId: 'creator',
      networkId: 'network-1',
      nonce: REQUEST_ID,
    };
    const conversationId = new ConversationIdFactory()
      .createGroup(
        ConversationParticipantId.fromString(genesis.creatorIdentityId),
        ConversationNetworkId.fromString(genesis.networkId),
        ConversationGroupNonce.fromString(genesis.nonce),
      )
      .toString();

    it('round-trips the genesis that derives the conversation id', () => {
      const fields: GroupMailboxControlFields = {
        conversationId,
        genesis: GroupMailboxGenesis.of(conversationId, genesis)!,
        requestId: REQUEST_ID,
        type: 'key-package-request',
      };

      expect(
        GroupMailboxControlRecord.decode(
          GroupMailboxControlRecord.encode(fields),
        ),
      ).toEqual(fields);
    });

    it.each([
      [
        'names another creator',
        conversationId,
        { ...genesis, creatorIdentityId: 'mallory' },
      ],
      ['derives another conversation id', 'conversation-1', genesis],
      ['is not an object', conversationId, 'creator'],
    ])('does not decode a request whose genesis %s', (_name, id, value) => {
      expect(
        GroupMailboxControlRecord.decode(
          json({
            ...header,
            conversationId: id,
            genesis: value,
            requestId: REQUEST_ID,
            type: 'key-package-request',
          }),
        ),
      ).toBeNull();
    });
  });
});
