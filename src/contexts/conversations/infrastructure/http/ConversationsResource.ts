import type { ConversationResource } from './ConversationResource';

export type ConversationsResource = {
  conversations: ConversationResource[];
  nextBeforeConversationId?: string;
};
