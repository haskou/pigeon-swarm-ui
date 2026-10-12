import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';

export type LoadedMessagesResult = {
  messages: ChatMessage[];
  nextCursor?: null | string;
};
