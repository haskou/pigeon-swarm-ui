import { ConversationProjector } from './ConversationProjector';

describe(ConversationProjector.name, () => {
  it('normalizes envelope responses and preserves server IDs', () => {
    const projector = new ConversationProjector();
    const conversations = projector.list({
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
    const projector = new ConversationProjector();

    expect(
      projector.normalize(
        { conversationId: 'conversation-2', id: '' },
        'peer-1',
      ).peerIdentityId,
    ).toBe('peer-1');
  });
});
