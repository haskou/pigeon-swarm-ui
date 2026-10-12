import type { ChatMessage } from '../../presentation/view-models/ChatMessage';

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (messages: ChatMessage[]) => void;
};
