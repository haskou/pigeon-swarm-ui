import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessagePinResource } from '../../infrastructure/http/MessagePinResource';

export type MessagePin = Omit<MessagePinResource, 'message'> & {
  message: ChatMessage;
};
