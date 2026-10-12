import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export function withoutMessageById(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  return messages.filter((message) => message.id !== messageId);
}
