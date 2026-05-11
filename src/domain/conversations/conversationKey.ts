import type { ConversationKeyEntry, LocalKeychain } from '../types';

import { ConversationIdFactory } from './ConversationIdFactory';

export function conversationKeyEntry(
  keychain: LocalKeychain,
  currentIdentityId: string,
  conversationId: string,
  ids: ConversationIdFactory = new ConversationIdFactory(),
): ConversationKeyEntry | undefined {
  return (
    keychain.conversations[conversationId] ??
    Object.values(keychain.conversations).find(
      (key) =>
        key.conversationId === conversationId ||
        ids.create(currentIdentityId, key.peerIdentityId) === conversationId,
    )
  );
}
