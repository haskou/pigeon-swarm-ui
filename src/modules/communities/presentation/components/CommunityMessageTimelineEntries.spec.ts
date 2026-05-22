import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityMessageTimelineEntries } from './CommunityMessageTimelineEntries';

const timestamp = Date.UTC(2026, 4, 22, 10, 0, 0);

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  attachments: [],
  authorIdentityId: 'identity-a',
  content: 'hello',
  encrypted: false,
  id: 'message-a',
  mine: false,
  raw: { id: 'message-a', type: 'sent' },
  reactions: [],
  timestamp,
  ...overrides,
});

const poll = (overrides: Partial<PollResource> = {}): PollResource => ({
  allowsMultipleVotes: false,
  createdAt: timestamp + 2000,
  creatorIdentityId: 'identity-a',
  id: 'poll-a',
  options: [{ id: 'option-a', text: 'Yes' }],
  question: 'Poll?',
  scope: {
    channelId: 'channel-a',
    communityId: 'community-a',
    networkId: 'network-a',
    type: 'community_channel',
  },
  status: 'open',
  votes: [],
  ...overrides,
});

describe(CommunityMessageTimelineEntries.name, () => {
  it('builds author run metadata in one timeline pass while ignoring poll gaps', () => {
    const entries = CommunityMessageTimelineEntries.build(
      [
        message({ id: 'message-a', timestamp, authorIdentityId: 'identity-a' }),
        message({
          id: 'message-b',
          timestamp: timestamp + 1000,
          authorIdentityId: 'identity-a',
        }),
        message({
          id: 'message-c',
          timestamp: timestamp + 3000,
          authorIdentityId: 'identity-b',
        }),
      ],
      [poll({ createdAt: timestamp + 2000 })],
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      'message:message-a',
      'message:message-b',
      'poll:poll-a',
      'message:message-c',
    ]);
    expect(entries[0]).toMatchObject({
      showAvatar: false,
      startsNewAuthorRun: true,
      type: 'message',
    });
    expect(entries[1]).toMatchObject({
      showAvatar: true,
      startsNewAuthorRun: false,
      type: 'message',
    });
    expect(entries[3]).toMatchObject({
      showAvatar: true,
      startsNewAuthorRun: true,
      type: 'message',
    });
  });

  it('links reply targets and starts new day after poll separators', () => {
    const nextDay = Date.UTC(2026, 4, 23, 8, 0, 0);
    const entries = CommunityMessageTimelineEntries.build(
      [
        message({ id: 'message-a', timestamp }),
        message({
          id: 'message-b',
          replyToMessageId: 'message-a',
          timestamp: nextDay + 1000,
        }),
      ],
      [poll({ createdAt: nextDay })],
    );
    const replyEntry = entries[2];

    expect(entries[1]).toMatchObject({
      startsNewDay: true,
      type: 'poll',
    });
    expect(replyEntry).toMatchObject({
      startsNewDay: false,
      type: 'message',
    });
    expect(replyEntry.type === 'message' && replyEntry.replyMessage?.id).toBe(
      'message-a',
    );
  });
});
