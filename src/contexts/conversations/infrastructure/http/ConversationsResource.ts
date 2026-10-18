import type { ConversationResource } from './ConversationResource';

export type ConversationsResource = {
  conversations: ConversationResource[];
  nextCursor: string | null;
};
