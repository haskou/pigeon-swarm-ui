import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';

describe(ConversationMapper.name, () => {
  it('normalizes envelope responses and preserves server IDs', () => {
    const mapper = new ConversationMapper();
    const conversations = mapper.list({
      items: [
        {
          id: 'conversation-1',
          networkId: 'network-1',
          participantIds: ['left', 'right'],
        },
      ],
    });

    expect(conversations).toEqual([
      {
        conversationId: 'conversation-1',
        id: 'conversation-1',
        networkId: 'network-1',
        participantIdentityIds: ['left', 'right'],
        participantIds: ['left', 'right'],
        peerIdentityId: undefined,
      },
    ]);
  });

  it('uses the fallback peer when the API omits peerIdentityId', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.normalize(
        { conversationId: 'conversation-2', id: '', networkId: 'network-1' },
        'peer-1',
      ).peerIdentityId,
    ).toBe('peer-1');
  });

  it('maps resources to the aggregate and back at the HTTP boundary', () => {
    const mapper = new ConversationMapper();
    const conversation = mapper.fromPrimitives({
      id: 'group:a',
      latestMessageAt: 100,
      name: 'Friends',
      networkId: 'network-a',
      participantIds: ['identity-a', 'identity-b'],
      type: 'group',
      unreadCount: 2,
    });

    expect(mapper.toResource(conversation)).toMatchObject({
      id: 'group:a',
      participantIdentityIds: ['identity-a', 'identity-b'],
      title: 'Friends',
      type: 'group',
      unreadCount: 2,
    });
  });

  it('preserves an absent latest message timestamp', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.toResource(
        mapper.fromPrimitives({
          id: 'group:empty',
          name: 'Empty group',
          networkId: 'network-a',
          participantIds: ['identity-a', 'identity-b'],
          type: 'group',
        }),
      ).latestMessageAt,
    ).toBeUndefined();
  });
});
