import type {
  Community,
  LocalKeychain,
} from '../../../shared/domain/pigeonResources.types';

export type LeaveCommunityResult = {
  community: Community | null;
  communityId: string;
  keychain: LocalKeychain;
  keychainExternalIdentifier: null | string;
};
