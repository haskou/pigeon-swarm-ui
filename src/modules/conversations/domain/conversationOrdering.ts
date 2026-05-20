import type { ConversationResource } from '../../../shared/domain/pigeonResources.types';

function conversationActivity(conversation: ConversationResource): number {
  return Number(conversation.latestMessageAt ?? 0);
}

export function sortConversationsByLatestMessage<
  T extends ConversationResource,
>(conversations: T[]): T[] {
  return [...conversations].sort(
    (left, right) => conversationActivity(right) - conversationActivity(left),
  );
}

export function bumpConversationActivity(
  conversations: ConversationResource[],
  conversationId: string,
  timestamp: number,
): ConversationResource[] {
  return sortConversationsByLatestMessage(
    conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            latestMessageAt: Math.max(
              conversationActivity(conversation),
              timestamp,
            ),
          }
        : conversation,
    ),
  );
}
