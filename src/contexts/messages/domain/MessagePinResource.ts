import type { MessageResource } from '../infrastructure/http/MessageResource';

export type MessagePinResource = {
  createdAt: number;
  message: MessageResource;
  messageId: string;
  pinnedByIdentityId: string;
};
