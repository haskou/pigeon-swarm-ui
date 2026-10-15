import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';
import { GroupMailboxGenesis } from '../../../../contexts/groupMailboxes/domain/GroupMailboxGenesis';

const FIELDS = {
  creatorIdentityId: 'creator',
  networkId: 'network-1',
  nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
};
const CONVERSATION = new ConversationIdFactory()
  .createGroup(
    ConversationParticipantId.fromString(FIELDS.creatorIdentityId),
    ConversationNetworkId.fromString(FIELDS.networkId),
    ConversationGroupNonce.fromString(FIELDS.nonce),
  )
  .toString();

describe('GroupMailboxGenesis', () => {
  it('names the creator of the group id it derives', () => {
    const genesis = GroupMailboxGenesis.of(CONVERSATION, FIELDS);

    expect(genesis?.conversationId).toBe(CONVERSATION);
    expect(genesis?.creatorIdentityId).toBe('creator');
    expect(genesis?.toPrimitives()).toEqual(FIELDS);
  });

  it.each([
    ['another creator', { ...FIELDS, creatorIdentityId: 'mallory' }],
    ['another network', { ...FIELDS, networkId: 'network-2' }],
    ['another nonce', { ...FIELDS, nonce: 'BBBBBBBBBBBBBBBBBBBBBB' }],
    [
      'a creator not in its kept form',
      { ...FIELDS, creatorIdentityId: ' creator' },
    ],
    ['a missing field', { networkId: FIELDS.networkId, nonce: FIELDS.nonce }],
    ['a field that is not a string', { ...FIELDS, nonce: 7 }],
    ['an empty field', { ...FIELDS, networkId: '' }],
    ['an overlong field', { ...FIELDS, networkId: 'n'.repeat(1025) }],
    ['null', null],
    ['a string', 'creator'],
  ])('rejects %s', (_name, value) => {
    expect(GroupMailboxGenesis.of(CONVERSATION, value)).toBeUndefined();
  });

  it('rejects fields that derive another group id', () => {
    expect(GroupMailboxGenesis.of('group:other', FIELDS)).toBeUndefined();
  });
});
