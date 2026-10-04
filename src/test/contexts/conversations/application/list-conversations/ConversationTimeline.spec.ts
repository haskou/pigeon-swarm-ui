import { ConversationTimeline } from '../../../../../contexts/conversations/presentation/view-models/ConversationTimeline';

const base = {
  participantIds: ['identity-a'],
  type: 'one-to-one' as const,
  unreadCount: 0,
};

describe('conversation ordering', () => {
  it('orders conversations with the newest latest message first', () => {
    expect(
      ConversationTimeline.sortByLatestMessage([
        { ...base, id: 'old', latestMessageAt: 10, networkId: 'net' },
        { ...base, id: 'new', latestMessageAt: 30, networkId: 'net' },
        { ...base, id: 'empty', networkId: 'net' },
      ]).map((conversation) => conversation.id),
    ).toEqual(['new', 'old', 'empty']);
  });

  it('bumps a conversation activity and keeps the list ordered', () => {
    expect(
      ConversationTimeline.bumpActivity(
        [
          { ...base, id: 'first', latestMessageAt: 50, networkId: 'net' },
          { ...base, id: 'second', latestMessageAt: 20, networkId: 'net' },
        ],
        'second',
        80,
      ).map((conversation) => [conversation.id, conversation.latestMessageAt]),
    ).toEqual([
      ['second', 80],
      ['first', 50],
    ]);
  });
});
