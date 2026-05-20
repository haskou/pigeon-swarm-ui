import { StringValueObject } from '@haskou/value-objects';

import type { ConversationKeyEntry, LocalKeychain } from '../../../shared/domain/pigeonResources.types';

function sameValue(left: string, right: string): boolean {
  return new StringValueObject(left, Number.MAX_SAFE_INTEGER).isEqual(
    new StringValueObject(right, Number.MAX_SAFE_INTEGER),
  );
}

export function conversationKeyEntry(
  keychain: LocalKeychain,
  currentIdentityId: string,
  conversationId: string,
): ConversationKeyEntry | undefined {
  return (
    keychain.conversations[conversationId] ??
    Object.values(keychain.conversations).find(
      (key) =>
        sameValue(key.conversationId, conversationId) &&
        !sameValue(key.peerIdentityId, currentIdentityId),
    )
  );
}
