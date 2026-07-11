import { Timestamp } from '@haskou/value-objects';

import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';

export class ConversationTimeline {
  public static bumpActivity(
    conversations: ConversationResource[],
    conversationId: string,
    timestamp: number,
  ): ConversationResource[] {
    const activityTimestamp = new Timestamp(timestamp);

    return ConversationTimeline.sortByLatestMessage(
      conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;

        const latestMessageAt = new Timestamp(
          conversation.latestMessageAt ?? 0,
        );

        return {
          ...conversation,
          latestMessageAt: activityTimestamp.isAfter(latestMessageAt)
            ? activityTimestamp.valueOf()
            : latestMessageAt.valueOf(),
        };
      }),
    );
  }

  public static sortByLatestMessage<T extends ConversationResource>(
    conversations: T[],
  ): T[] {
    return [...conversations].sort(
      (left, right) =>
        Number(right.latestMessageAt ?? 0) - Number(left.latestMessageAt ?? 0),
    );
  }
}
