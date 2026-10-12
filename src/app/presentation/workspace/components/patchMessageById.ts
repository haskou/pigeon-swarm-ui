import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';

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
