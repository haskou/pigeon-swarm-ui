import type { ChatMessage, PollResource } from '../../../../shared/domain/pigeonResources.types';

export type MessagePollTimelineItem =
  | {
      id: string;
      message: ChatMessage;
      timestamp: number;
      type: 'message';
    }
  | {
      id: string;
      poll: PollResource;
      timestamp: number;
      type: 'poll';
    };

export function messagePollTimelineItems(
  messages: ChatMessage[],
  polls: PollResource[],
): MessagePollTimelineItem[] {
  const pollItems = new Map<string, PollResource>();
  const timelineItems: MessagePollTimelineItem[] = [];

  for (const message of messages) {
    if (message.kind === 'poll' && message.poll) {
      pollItems.set(message.poll.id, message.poll);
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
    pollItems.set(poll.id, poll);
  }

  for (const poll of pollItems.values()) {
    timelineItems.push({
      id: `poll:${poll.id}`,
      poll,
      timestamp: poll.createdAt,
      type: 'poll',
    });
  }

  return timelineItems.sort((left, right) => left.timestamp - right.timestamp);
}
