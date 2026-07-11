import type { MessagePinResource } from '../infrastructure/http/MessagePinResource';
import type { ChatMessage } from '../presentation/view-models/ChatMessage';

export type MessagePin = Omit<MessagePinResource, 'message'> & {
  message: ChatMessage;
};
