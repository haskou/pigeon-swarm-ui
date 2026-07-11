import type { ChatMessage } from '../presentation/view-models/ChatMessage';
import type { MessagePinResource } from './MessagePinResource';

export type MessagePin = Omit<MessagePinResource, 'message'> & {
  message: ChatMessage;
};
