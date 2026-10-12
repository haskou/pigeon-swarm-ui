import type { MessageResource } from './MessageResource';

export type MessageListEnvelope = {
  messages: MessageResource[];
  nextBeforeMessageId?: string;
};
