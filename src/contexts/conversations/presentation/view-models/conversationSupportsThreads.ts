import type { ConversationResource } from '../../infrastructure/http/ConversationResource';

export function conversationSupportsThreads(
  conversation?: Pick<ConversationResource, 'id' | 'type'> | null,
): boolean {
  return Boolean(
    conversation &&
      (conversation.type === 'group' || conversation.id.startsWith('group:')),
  );
}
