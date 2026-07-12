import type {
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CommunityKeychainPort {
  publishKeychain(
    session: Session,
    keychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }>;
}
