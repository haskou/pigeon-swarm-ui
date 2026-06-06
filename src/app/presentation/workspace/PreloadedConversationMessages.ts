import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

export type PreloadedConversationMessages = {
  conversationId: string;
  messages: ChatMessage[];
  nextCursor?: null | string;
};
