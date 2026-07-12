import type {
  Community,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

export type CreateCommunityResult = {
  community: Community;
  keychain: LocalKeychain;
  keychainExternalIdentifier: null | string;
};
