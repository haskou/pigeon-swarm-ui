import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../../../identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../identities/infrastructure/session/Session';

export type ConversationKeychainPublisher = {
  publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
};
