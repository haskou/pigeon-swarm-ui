import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';

export function withoutMessageById(
  messages: ChatMessage[],
  messageId: string,
): ChatMessage[] {
  return messages.filter((message) => message.id !== messageId);
}
