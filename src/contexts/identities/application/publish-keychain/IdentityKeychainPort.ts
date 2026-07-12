import type {
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface IdentityKeychainPort {
  publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
}
