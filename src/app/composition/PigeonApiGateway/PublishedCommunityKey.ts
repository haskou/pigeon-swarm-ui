import type { ConversationKeyEntry } from '../../../shared/domain/pigeonResources.types';
import type { LocalKeychain } from '../../../shared/domain/pigeonResources.types';

export type PublishedCommunityKey = {
  keyEntry: ConversationKeyEntry;
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};
