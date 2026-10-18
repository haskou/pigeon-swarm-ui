import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';

const group = {
  adminIds: [],
  id: 'group:a',
  name: 'Friends',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
  type: 'group',
};

const row = {
  id: 'one-to-one:a',
  networkId: 'network-a',
  participantIds: ['identity-a', 'identity-b'],
};

const oneToOne = { ...row, adminIds: [], type: 'one-to-one' };

describe(ConversationMapper.name, () => {
  it('parses the conversations list response, dropping group rows', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.list({
        conversations: [group, oneToOne],
        nextCursor: 'x',
      }),
    ).toEqual([oneToOne]);
  });

  it('maps a node row without adminIds, creatorId or type to a one-to-one conversation', () => {
    const mapper = new ConversationMapper();
    const resource = mapper.resource(row);

    expect(resource).toEqual(oneToOne);
    expect(mapper.list({ conversations: [row] })).toEqual([oneToOne]);
    expect(mapper.fromPrimitives(resource).isGroup()).toBe(false);
  });

  it('reads no adminIds, creatorId or type off a node row', () => {
    expect(
      new ConversationMapper().resource({
        ...row,
        adminIds: ['identity-a'],
        creatorId: 'identity-a',
        type: 'group',
      }),
    ).toEqual(oneToOne);
  });

  it.each([
    ['a bare array', [row]],
    ['an items envelope', { items: [row] }],
    ['a data envelope', { data: [row] }],
  ])('rejects %s as a list response', (_name, response) => {
    expect(() => new ConversationMapper().list(response)).toThrow(TypeError);
  });

  it('rejects a conversation without participantIds', () => {
    const invalid = { ...row, participantIds: undefined };

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
