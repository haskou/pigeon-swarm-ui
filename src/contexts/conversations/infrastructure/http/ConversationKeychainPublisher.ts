import type {
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type ConversationKeychainPublisher = {
  publish(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
};
