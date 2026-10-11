import type {
  LocalKeychain,
  LocalKeychainUpdate,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type ConversationKeychainPublisher = {
  publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
};
