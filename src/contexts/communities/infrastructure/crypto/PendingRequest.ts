import type { ChatMessage } from '../../../messages/domain/ChatMessage';

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (messages: ChatMessage[]) => void;
};
