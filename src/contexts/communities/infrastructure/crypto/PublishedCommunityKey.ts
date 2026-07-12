import type {
  ConversationKeyEntry,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

export type PublishedCommunityKey = {
  keyEntry: ConversationKeyEntry;
  keychain: LocalKeychain;
  keychainExternalIdentifier: string;
};
