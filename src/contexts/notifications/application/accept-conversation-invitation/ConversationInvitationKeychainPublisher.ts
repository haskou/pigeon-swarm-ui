import type {
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ConversationInvitationKeychainPublisher {
  publishKeychain(
    session: Session,
    keychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
}
