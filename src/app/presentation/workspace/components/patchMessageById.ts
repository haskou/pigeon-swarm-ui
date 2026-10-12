import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

// Returns a state updater that patches the message with `messageId`.
export function patchMessageById(
  messageId: string,
  patch: Partial<ChatMessage>,
): (messages: ChatMessage[]) => ChatMessage[] {
  return (messages) =>
    messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message,
    );
}
