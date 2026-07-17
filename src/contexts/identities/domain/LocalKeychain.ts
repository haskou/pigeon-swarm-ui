import type { ConversationKeyEntry } from '../infrastructure/keychain/ConversationKeyEntry';

export type LocalKeychain = {
  conversations: Record<string, ConversationKeyEntry>;
  timestamp?: number;
  version: number;
};
