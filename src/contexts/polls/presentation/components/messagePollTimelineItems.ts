import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

export type MessagePollTimelineItem =
  | {
      id: string;
      message: ChatMessage;
      timestamp: number;
      type: 'message';
    }
  | {
      id: string;
      message: ChatMessage;
      poll: PollResource;
      timestamp: number;
      type: 'poll';
    };

export function messagePollTimelineItems(
  messages: ChatMessage[],
  polls: PollResource[],
): MessagePollTimelineItem[] {
  const pollItems = new Map<
    string,
    {
      message: ChatMessage;
      poll: PollResource;
    }
  >();
  const timelineItems: MessagePollTimelineItem[] = [];

  for (const message of messages) {
    if (message.raw.type === 'edited') continue;

    if (message.kind === 'poll' && message.poll) {
      pollItems.set(message.poll.id, {
        message: pollChatMessage(message.poll, message),
        poll: message.poll,
      });
    } else {
      timelineItems.push({
        id: `message:${message.id}`,
        message,
        timestamp: message.timestamp,
        type: 'message',
      });
    }
  }

  for (const poll of polls) {
    const current = pollItems.get(poll.id);

    pollItems.set(poll.id, {
      message: pollChatMessage(poll, current?.message),
      poll,
    });
  }

  for (const { message, poll } of pollItems.values()) {
    timelineItems.push({
      id: `poll:${poll.id}`,
      message,
      poll,
      timestamp: poll.createdAt,
      type: 'poll',
    });
  }

  return timelineItems.sort((left, right) => left.timestamp - right.timestamp);
}

function pollChatMessage(
  poll: PollResource,
  message?: ChatMessage,
): ChatMessage {
  if (message) {
    return {
      ...message,
      authorIdentityId: poll.creatorIdentityId,
      content: message.content || poll.question,
      id: poll.id,
      kind: 'poll',
      poll,
      timestamp: poll.createdAt,
    };
  }

  return {
    attachments: [],
    authorIdentityId: poll.creatorIdentityId,
    content: poll.question,
    encrypted: false,
    id: poll.id,
    kind: 'poll',
    mine: false,
    poll,
    raw: {
      id: poll.id,
      poll,
      pollId: poll.id,
      type: 'poll',
    },
    reactions: [],
    timestamp: poll.createdAt,
  };
}
