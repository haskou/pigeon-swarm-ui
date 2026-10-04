import type { MessageResource } from '../../../../shared/domain/pigeonResources.types';

export type MessageListEnvelope = {
  messages: MessageResource[];
  nextBeforeMessageId?: string;
};
