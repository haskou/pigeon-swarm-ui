import type { MessagePinResource } from '../../infrastructure/http/MessagePinResource';
import type { ChatMessage } from './ChatMessage';

export type MessagePin = Omit<MessagePinResource, 'message'> & {
  message: ChatMessage;
};
