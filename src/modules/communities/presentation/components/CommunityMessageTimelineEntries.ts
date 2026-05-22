import type {
  ChatMessage,
  PollResource,
} from '../../../../shared/domain/pigeonResources.types';

import type { MessagePollTimelineItem } from '../../../polls/presentation/components/messagePollTimelineItems';
import { messagePollTimelineItems } from '../../../polls/presentation/components/messagePollTimelineItems';
import {
  endsAuthorRun,
  startsAuthorRun,
} from '../../../messages/presentation/components/messageTimelineHelpers';

export type CommunityMessageTimelineEntry =
  | {
      id: string;
      item: Extract<MessagePollTimelineItem, { type: 'poll' }>;
      startsNewDay: boolean;
      type: 'poll';
    }
  | {
      id: string;
      item: Extract<MessagePollTimelineItem, { type: 'message' }>;
      previousMessage?: ChatMessage;
      replyMessage?: ChatMessage;
      showAvatar: boolean;
      startsNewAuthorRun: boolean;
      startsNewDay: boolean;
      type: 'message';
    };

export class CommunityMessageTimelineEntries {
  public static build(
    visibleMessages: ChatMessage[],
    polls: PollResource[],
  ): CommunityMessageTimelineEntry[] {
    const items = messagePollTimelineItems(visibleMessages, polls);
    const messagesById = new Map(
      visibleMessages.map((message) => [message.id, message]),
    );
    const entries: CommunityMessageTimelineEntry[] = [];
    let previousMessage: ChatMessage | undefined;

    for (const [index, item] of items.entries()) {
      const startsNewDay = CommunityMessageTimelineEntries.startsTimelineDay(
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
        id: item.id,
        item,
        previousMessage,
        replyMessage: item.message.replyToMessageId
          ? messagesById.get(item.message.replyToMessageId)
          : undefined,
        showAvatar: true,
        startsNewAuthorRun: startsAuthorRun(previousMessage, item.message),
        startsNewDay,
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
        showAvatar: endsAuthorRun(nextMessage, entry.item.message),
      };
      nextMessage = entry.item.message;
    }

    return entries;
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
