import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

import type { MessagePollTimelineItem } from '../../../polls/presentation/components/messagePollTimelineItems';
import { messagePollTimelineItems } from '../../../polls/presentation/components/messagePollTimelineItems';
import {
  endsAuthorRun,
  startsAuthorRun,
} from '../components/messageTimelineHelpers';

export type MessageTimelineEntry =
  | {
      id: string;
      item: Extract<MessagePollTimelineItem, { type: 'poll' }>;
      startsNewDay: boolean;
      type: 'poll';
    }
  | {
      endsAuthorRun: boolean;
      id: string;
      item: Extract<MessagePollTimelineItem, { type: 'message' }>;
      previousMessage?: ChatMessage;
      replyMessage?: ChatMessage;
      startsNewAuthorRun: boolean;
      startsNewDay: boolean;
      threadSummary?: MessageThreadSummary;
      type: 'message';
    };

export type MessageThreadSummary = {
  count: number;
  lastMessage?: ChatMessage;
  rootMessageId: string;
};

export class MessageTimelineEntries {
  public static build(
    messages: ChatMessage[],
    polls: PollResource[],
  ): MessageTimelineEntry[] {
    const threadSummaries =
      MessageTimelineEntries.threadSummariesByRootMessageId(messages);
    const rootMessages = messages.filter((message) => !message.replyToMessageId);
    const items = messagePollTimelineItems(rootMessages, polls);
    const messagesById = new Map(
      rootMessages.map((message) => [message.id, message]),
    );
    const entries: MessageTimelineEntry[] = [];
    let previousMessage: ChatMessage | undefined;

    for (const [index, item] of items.entries()) {
      const startsNewDay = MessageTimelineEntries.startsTimelineDay(
        items[index - 1]?.timestamp,
        item.timestamp,
      );

      if (item.type === 'poll') {
        entries.push({
          id: item.id,
          item,
          startsNewDay,
          type: 'poll',
        });

        continue;
      }

      entries.push({
        endsAuthorRun: true,
        id: item.id,
        item,
        previousMessage,
        replyMessage: item.message.replyToMessageId
          ? messagesById.get(item.message.replyToMessageId)
          : undefined,
        startsNewAuthorRun: startsAuthorRun(previousMessage, item.message),
        startsNewDay,
        threadSummary: threadSummaries.get(item.message.id),
        type: 'message',
      });

      previousMessage = item.message;
    }

    let nextMessage: ChatMessage | undefined;

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];

      if (entry.type !== 'message') continue;

      entries[index] = {
        ...entry,
        endsAuthorRun: endsAuthorRun(nextMessage, entry.item.message),
      };
      nextMessage = entry.item.message;
    }

    return entries;
  }

  private static threadSummariesByRootMessageId(
    messages: ChatMessage[],
  ): Map<string, MessageThreadSummary> {
    const summaries = new Map<string, MessageThreadSummary>();

    for (const message of messages) {
      if (!message.replyToMessageId) continue;

      const current = summaries.get(message.replyToMessageId);

      if (!current) {
        summaries.set(message.replyToMessageId, {
          count: 1,
          lastMessage: message,
          rootMessageId: message.replyToMessageId,
        });

        continue;
      }

      summaries.set(message.replyToMessageId, {
        count: current.count + 1,
        lastMessage:
          !current.lastMessage ||
          message.timestamp >= current.lastMessage.timestamp
            ? message
            : current.lastMessage,
        rootMessageId: message.replyToMessageId,
      });
    }

    return summaries;
  }

  private static startsTimelineDay(
    previousTimestamp: number | undefined,
    timestamp: number,
  ): boolean {
    if (!previousTimestamp) return true;

    return (
      new Date(previousTimestamp).toDateString() !==
      new Date(timestamp).toDateString()
    );
  }
}
