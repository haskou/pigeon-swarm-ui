import type { ConversationKeyEntry } from '../../conversations/domain/conversationResources.types';

export type LocalKeychain = {
  conversations: Record<string, ConversationKeyEntry>;
  timestamp?: number;
  version: number;
};
