import type { ConversationResource } from '../../infrastructure/http/ConversationResource';

export function conversationSupportsThreads(
  conversation?: Pick<ConversationResource, 'id' | 'type'> | null,
): boolean {
  return conversation?.type === 'group';
}
