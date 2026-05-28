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
    threadSummaries: MessageThreadSummary[] = [],
  ): MessageTimelineEntry[] {
    const threadSummariesByRootMessageId = new Map(
      threadSummaries.map((summary) => [summary.rootMessageId, summary]),
    );
    const threadRootMessageIds = new Set(
      threadSummaries.map((summary) => summary.rootMessageId),
    );
    const rootMessages = messages.filter(
      (message) =>
        !threadRootMessageIds.has(
          MessageTimelineEntries.replyToMessageId(message) ?? '',
        ),
    );
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

      const replyToMessageId = MessageTimelineEntries.replyToMessageId(
        item.message,
      );

      entries.push({
        endsAuthorRun: true,
        id: item.id,
        item,
        previousMessage,
        replyMessage: replyToMessageId
          ? messagesById.get(replyToMessageId)
          : undefined,
        startsNewAuthorRun: startsAuthorRun(previousMessage, item.message),
        startsNewDay,
        threadSummary: threadSummariesByRootMessageId.get(item.message.id),
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

  private static replyToMessageId(message: ChatMessage): string | undefined {
    return message.replyToMessageId ?? message.raw.replyToMessageId;
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
