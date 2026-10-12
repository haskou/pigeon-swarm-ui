import type { ChatMessage } from '../../../messages/presentation/view-models/ChatMessage';

export type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (messages: ChatMessage[]) => void;
};
