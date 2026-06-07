import type { ChatMessage } from './ChatMessage';
import type { MessagePinResource } from './MessagePinResource';

export type MessagePin = Omit<MessagePinResource, 'message'> & {
  message: ChatMessage;
};
