import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { LocalKeychain } from '../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

export type LeaveCommunityResult = {
  community: Community | null;
  communityId: string;
  keychain: LocalKeychain;
  keychainExternalIdentifier: null | string;
};
