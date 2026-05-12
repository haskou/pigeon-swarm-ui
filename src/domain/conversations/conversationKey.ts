import type { ConversationKeyEntry, LocalKeychain } from '../types';

export function conversationKeyEntry(
  keychain: LocalKeychain,
  currentIdentityId: string,
  conversationId: string,
): ConversationKeyEntry | undefined {
  return (
    keychain.conversations[conversationId] ??
    Object.values(keychain.conversations).find(
      (key) =>
        key.conversationId === conversationId &&
        key.peerIdentityId !== currentIdentityId,
    )
  );
}
