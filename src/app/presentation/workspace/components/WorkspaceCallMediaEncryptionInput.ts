import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { LocalKeychain } from '../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

export type WorkspaceCallMediaEncryptionInput = {
  call: CallResource;
  communities: Community[];
  currentIdentityId: string;
  communityCallKey: (communityId: string, callId: string) => Promise<string>;
  enabled: boolean;
  keychain: LocalKeychain;
};
