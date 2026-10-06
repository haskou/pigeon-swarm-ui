import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';

const group = {
  id: 'group:a',
  name: 'Friends',
  networkId: 'network-a',
  adminIds: [],
  participantIds: ['identity-a', 'identity-b'],
  type: 'group',
  unreadCount: 2,
};

describe(ConversationMapper.name, () => {
  it('parses the conversations list response', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.list({ conversations: [group], nextBeforeConversationId: 'x' }),
    ).toEqual([group]);
  });

  it.each([
    ['a bare array', [group]],
    ['an items envelope', { items: [group] }],
    ['a data envelope', { data: [group] }],
  ])('rejects %s as a list response', (_name, response) => {
    expect(() => new ConversationMapper().list(response)).toThrow(TypeError);
  });

  it('rejects a conversation without participantIds', () => {
    const invalid = { ...group, participantIds: undefined };

    expect(() => new ConversationMapper().resource(invalid)).toThrow(TypeError);
  });

  it('maps resources to the aggregate and back at the HTTP boundary', () => {
    const mapper = new ConversationMapper();
    const conversation = mapper.fromPrimitives({
      ...group,
      latestMessageAt: 100,
      type: 'group',
    });

    expect(mapper.toResource(conversation)).toEqual({
      ...group,
      latestMessageAt: 100,
    });
  });

  it('preserves an absent latest message timestamp', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.toResource(mapper.fromPrimitives({ ...group, type: 'group' }))
        .latestMessageAt,
    ).toBeUndefined();
  });
});
