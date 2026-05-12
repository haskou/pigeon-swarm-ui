import {
  bumpConversationActivity,
  sortConversationsByLatestMessage,
} from './conversationOrdering';

describe('conversation ordering', () => {
  it('orders conversations with the newest latest message first', () => {
    expect(
      sortConversationsByLatestMessage([
        { id: 'old', latestMessageAt: 10, networkId: 'net' },
        { id: 'new', latestMessageAt: 30, networkId: 'net' },
        { id: 'empty', networkId: 'net' },
      ]).map((conversation) => conversation.id),
    ).toEqual(['new', 'old', 'empty']);
  });

  it('bumps a conversation activity and keeps the list ordered', () => {
    expect(
      bumpConversationActivity(
        [
          { id: 'first', latestMessageAt: 50, networkId: 'net' },
          { id: 'second', latestMessageAt: 20, networkId: 'net' },
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
