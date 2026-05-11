import { ConversationMapper } from './ConversationMapper';

describe(ConversationMapper.name, () => {
  it('normalizes envelope responses and preserves server IDs', () => {
    const mapper = new ConversationMapper();
    const conversations = mapper.list({
      items: [
        {
          id: 'conversation-1',
          participantIds: ['left', 'right'],
        },
      ],
    });

    expect(conversations).toEqual([
      {
        conversationId: 'conversation-1',
        id: 'conversation-1',
        participantIdentityIds: ['left', 'right'],
        participantIds: ['left', 'right'],
        peerIdentityId: undefined,
      },
    ]);
  });

  it('uses the fallback peer when the API omits peerIdentityId', () => {
    const mapper = new ConversationMapper();

    expect(
      mapper.normalize({ conversationId: 'conversation-2', id: '' }, 'peer-1')
        .peerIdentityId,
    ).toBe('peer-1');
  });
});
