import type { MessageResource } from './MessageResource';

export type MessagePinResource = {
  createdAt: number;
  message: MessageResource;
  messageId: string;
  pinnedByIdentityId: string;
};
