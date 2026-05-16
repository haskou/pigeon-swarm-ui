import type { ChatMessage } from '../types';

export function updateMessageReaction(
  message: ChatMessage,
  authorIdentityId: string,
  emoji: string,
  action: 'add' | 'remove',
  createdAt = Date.now(),
): ChatMessage {
  const withoutReaction = (message.reactions ?? []).filter(
    (reaction) =>
      reaction.authorIdentityId !== authorIdentityId ||
      reaction.emoji !== emoji,
  );
  const reactions =
    action === 'add'
      ? [...withoutReaction, { authorIdentityId, createdAt, emoji }]
      : withoutReaction;

  return {
    ...message,
    raw: { ...message.raw, reactions },
    reactions,
  };
}
