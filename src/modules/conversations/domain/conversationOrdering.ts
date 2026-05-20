import { Timestamp } from '@haskou/value-objects';

import type { ConversationResource } from '../../../shared/domain/pigeonResources.types';

import { Conversation } from './aggregates/conversation';
import { ConversationId } from './value-objects/conversationId';

export class ConversationTimeline {
  public static bumpActivity(
    conversations: ConversationResource[],
    conversationId: string,
    timestamp: number,
  ): ConversationResource[] {
    const targetConversationId = ConversationId.fromString(conversationId);
    const activityTimestamp = new Timestamp(timestamp);

    return ConversationTimeline.sortByLatestMessage(
      conversations.map((conversation) => {
        const candidate = Conversation.fromResource(conversation);

        return candidate.getId().isEqual(targetConversationId)
          ? candidate.bumpActivity(activityTimestamp)
          : conversation;
      }),
    );
  }

  public static sortByLatestMessage<T extends ConversationResource>(
    conversations: T[],
  ): T[] {
    return [...conversations].sort((left, right) => {
      const leftConversation = Conversation.fromResource(left);
      const rightConversation = Conversation.fromResource(right);

      if (leftConversation.isMoreRecentThan(rightConversation)) return -1;

      if (rightConversation.isMoreRecentThan(leftConversation)) return 1;

      return 0;
    });
  }
}
