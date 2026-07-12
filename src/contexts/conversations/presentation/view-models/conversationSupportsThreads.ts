import type { ConversationResource } from '../../infrastructure/http/ConversationResource';

export function conversationSupportsThreads(
  conversation?: Pick<
    ConversationResource,
    'conversationId' | 'id' | 'type'
  > | null,
): boolean {
  const identifiers = [conversation?.id, conversation?.conversationId].filter(
    (identifier): identifier is string => Boolean(identifier),
  );

  if (
    conversation?.type === 'one-to-one' ||
    identifiers.some((identifier) => identifier.startsWith('one-to-one:'))
  ) {
    return false;
  }

  return Boolean(
    conversation &&
    (conversation.type === 'group' || conversation.id.startsWith('group:')),
  );
}
