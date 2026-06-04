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
    const visibleThreadSummaries = threadSummaries.filter((summary) =>
      MessageTimelineEntries.isVisibleThreadSummary(summary),
    );
    const knownThreadMessageIds =
      MessageTimelineEntries.knownThreadMessageIds(visibleThreadSummaries);
    const threadSummariesByRootMessageId = new Map(
      visibleThreadSummaries.map((summary) => [
        summary.rootMessageId,
        summary,
      ]),
    );
    const rootMessages = messages.filter(
      (message) =>
        !MessageTimelineEntries.threadRootMessageId(message) &&
        !knownThreadMessageIds.has(message.id),
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

  private static threadRootMessageId(message: ChatMessage): string | undefined {
    return message.threadRootMessageId;
  }

  private static isVisibleThreadSummary(
    summary: MessageThreadSummary,
  ): boolean {
    if (!summary.lastMessage) return true;

    if (
      MessageTimelineEntries.threadRootMessageId(summary.lastMessage) ===
      summary.rootMessageId
    ) {
      return true;
    }

    return MessageTimelineEntries.isUnmarkedThreadReply(summary);
  }

  private static isUnmarkedThreadReply(
    summary: MessageThreadSummary,
  ): boolean {
    const lastMessage = summary.lastMessage;

    if (!lastMessage?.replyPreview) return false;

    return (
      MessageTimelineEntries.replyToMessageId(lastMessage) ===
        summary.rootMessageId &&
      lastMessage.replyPreview.messageId !== summary.rootMessageId
    );
  }

  private static knownThreadMessageIds(
    threadSummaries: MessageThreadSummary[],
  ): Set<string> {
    return new Set(
      threadSummaries
        .map((summary) => summary.lastMessage?.id)
        .filter((messageId): messageId is string => Boolean(messageId)),
    );
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
