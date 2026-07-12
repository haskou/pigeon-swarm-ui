import { StringValueObject } from '@haskou/value-objects';

import type {
  ConversationKeyEntry,
  LocalKeychain,
} from '../../../shared/domain/pigeonResources.types';

function sameValue(left: string, right: string): boolean {
  return new StringValueObject(left, Number.MAX_SAFE_INTEGER).isEqual(
    new StringValueObject(right, Number.MAX_SAFE_INTEGER),
  );
}

export class ConversationKeychain {
  private static entryMatchesConversationId(
    entryId: string,
    entry: ConversationKeyEntry,
    conversationId: string,
  ): boolean {
    return (
      sameValue(entryId, conversationId) ||
      sameValue(entry.conversationId, conversationId)
    );
  }

  public static withEntry(
    keychain: LocalKeychain,
    entry: ConversationKeyEntry,
  ): LocalKeychain {
    return {
      conversations: {
        ...keychain.conversations,
        [entry.conversationId]: entry,
      },
      version: keychain.version + 1,
    };
  }

  public static hasEntry(
    keychain: LocalKeychain,
    conversationId: string,
  ): boolean {
    return Object.entries(keychain.conversations).some(([entryId, entry]) =>
      ConversationKeychain.entryMatchesConversationId(
        entryId,
        entry,
        conversationId,
      ),
    );
  }

  public static hasCommunityEntry(
    keychain: LocalKeychain,
    communityId: string,
  ): boolean {
    return Object.entries(keychain.conversations).some(([entryId, entry]) =>
      ConversationKeychain.entryMatchesConversationId(
        entryId,
        entry,
        communityId,
      ),
    );
  }

  public static entry(
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

  public static withoutCommunityEntry(
    keychain: LocalKeychain,
    communityId: string,
  ): LocalKeychain {
    if (!ConversationKeychain.hasCommunityEntry(keychain, communityId)) {
      return keychain;
    }

    const conversations: Record<string, ConversationKeyEntry> = {};

    for (const [entryId, entry] of Object.entries(keychain.conversations)) {
      const isTargetCommunityEntry =
        ConversationKeychain.entryMatchesConversationId(
          entryId,
          entry,
          communityId,
        );

      if (isTargetCommunityEntry) continue;

      conversations[entryId] = entry;
    }

    return {
      ...keychain,
      conversations,
    };
  }

  public static withoutEntry(
    keychain: LocalKeychain,
    conversationId: string,
  ): LocalKeychain {
    if (!ConversationKeychain.hasEntry(keychain, conversationId)) {
      return keychain;
    }

    const conversations: Record<string, ConversationKeyEntry> = {};

    for (const [entryId, entry] of Object.entries(keychain.conversations)) {
      if (
        ConversationKeychain.entryMatchesConversationId(
          entryId,
          entry,
          conversationId,
        )
      ) {
        continue;
      }

      conversations[entryId] = entry;
    }

    return {
      ...keychain,
      conversations,
    };
  }
}
