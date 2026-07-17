import type { ConversationKeyEntry } from './ConversationKeyEntry';

export type LocalKeychain = {
  conversations: Record<string, ConversationKeyEntry>;
  timestamp?: number;
  version: number;
};
