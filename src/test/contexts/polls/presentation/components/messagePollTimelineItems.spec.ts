import type {
  ChatMessage,
  PollResource,
} from '../../../../../shared/domain/pigeonResources.types';

import { messagePollTimelineItems } from '../../../../../contexts/polls/presentation/components/messagePollTimelineItems';

describe(messagePollTimelineItems.name, () => {
  const poll: PollResource = {
    allowsMultipleVotes: false,
    createdAt: 20,
    creatorIdentityId: 'identity-1',
    id: 'poll-1',
    options: [],
    question: 'Question?',
    scope: {
      channelId: 'channel-1',
      communityId: 'community-1',
      networkId: 'network-1',
      type: 'community_channel',
    },
    status: 'open',
    votes: [],
  };
  const pollMessage: ChatMessage = {
    attachments: [],
    authorIdentityId: 'identity-1',
    content: '',
    encrypted: false,
    id: 'poll-1',
    kind: 'poll',
    mine: true,
    poll,
    raw: { id: 'poll-1', pollId: 'poll-1', type: 'poll' },
    reactions: [],
    timestamp: 20,
  };
  const textMessage: ChatMessage = {
    attachments: [],
    authorIdentityId: 'identity-2',
    content: 'hello',
    encrypted: false,
    id: 'message-1',
    mine: false,
    raw: { id: 'message-1', type: 'sent' },
    reactions: [],
    timestamp: 10,
  };

  it('deduplicates a poll that arrives both as a channel timeline item and poll state', () => {
    expect(
      messagePollTimelineItems([textMessage, pollMessage], [poll]),
    ).toEqual([
      {
        id: 'message:message-1',
        message: textMessage,
        timestamp: 10,
        type: 'message',
      },
      {
        id: 'poll:poll-1',
        message: {
          ...pollMessage,
          content: poll.question,
        },
        poll,
        timestamp: 20,
        type: 'poll',
      },
    ]);
  });

  it('keeps hidden edit events out of rendered timeline items', () => {
    const editEvent: ChatMessage = {
      ...textMessage,
      content: 'edited',
      id: 'edit-message-1',
      raw: {
        id: 'edit-message-1',
        targetMessageId: 'message-1',
        type: 'edited',
      },
      timestamp: 20,
    };

    expect(messagePollTimelineItems([editEvent, textMessage], [])).toEqual([
      {
        id: 'message:message-1',
        message: textMessage,
        timestamp: 10,
        type: 'message',
      },
    ]);
  });

  it('creates a replyable message for poll state entries without timeline messages', () => {
    expect(messagePollTimelineItems([], [poll])).toEqual([
      {
        id: 'poll:poll-1',
        message: {
          attachments: [],
          authorIdentityId: 'identity-1',
          content: 'Question?',
          encrypted: false,
          id: 'poll-1',
          kind: 'poll',
          mine: false,
          poll,
          raw: {
            id: 'poll-1',
            poll,
            pollId: 'poll-1',
            type: 'poll',
          },
          reactions: [],
          timestamp: 20,
        },
        poll,
        timestamp: 20,
        type: 'poll',
      },
    ]);
  });
});
