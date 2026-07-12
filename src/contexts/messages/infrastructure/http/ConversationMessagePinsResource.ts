import type { MessagePinResource } from './MessagePinResource';

export type ConversationMessagePinsResource = {
  conversationId: string;
  pins: MessagePinResource[];
};
