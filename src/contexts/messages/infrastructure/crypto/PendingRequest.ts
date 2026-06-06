import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (messages: ChatMessage[]) => void;
};
