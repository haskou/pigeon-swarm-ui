import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageTimelineEntries } from './MessageTimelineEntries';

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
    conversationId: 'conversation-a',
    networkId: 'network-a',
    type: 'group_conversation',
  },
  status: 'open',
  votes: [],
  ...overrides,
});

describe(MessageTimelineEntries.name, () => {
  it('builds author run metadata in one pass while ignoring poll gaps', () => {
    const entries = MessageTimelineEntries.build(
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
      endsAuthorRun: false,
      startsNewAuthorRun: true,
      type: 'message',
    });
    expect(entries[1]).toMatchObject({
      endsAuthorRun: true,
      startsNewAuthorRun: false,
      type: 'message',
    });
    expect(entries[3]).toMatchObject({
      endsAuthorRun: true,
      startsNewAuthorRun: true,
      type: 'message',
    });
  });

  it('keeps thread messages out of the main timeline and summarizes them on the root', () => {
    const nextDay = Date.UTC(2026, 4, 23, 8, 0, 0);
    const entries = MessageTimelineEntries.build(
      [
        message({ id: 'message-a', timestamp }),
        message({
          id: 'message-b',
          replyToMessageId: 'message-a',
          timestamp: nextDay + 1000,
        }),
        message({
          id: 'message-c',
          replyToMessageId: 'message-a',
          timestamp: nextDay + 2000,
        }),
      ],
      [poll({ createdAt: nextDay })],
    );
    const rootEntry = entries[0];

    expect(entries[1]).toMatchObject({
      startsNewDay: true,
      type: 'poll',
    });
    expect(entries.map((entry) => entry.id)).toEqual([
      'message:message-a',
      'poll:poll-a',
    ]);
    expect(rootEntry).toMatchObject({
      threadSummary: {
        count: 2,
        lastMessage: expect.objectContaining({ id: 'message-c' }),
        rootMessageId: 'message-a',
      },
      type: 'message',
    });
  });
});
