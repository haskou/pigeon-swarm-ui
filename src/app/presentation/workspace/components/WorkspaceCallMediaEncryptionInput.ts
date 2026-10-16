import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallMediaKey } from '../../../../contexts/calls/infrastructure/media/CallMediaKey';
import type { CommunityOperation } from '../../../../contexts/communities/domain/operations/CommunityOperation';
import type { LocalKeychain } from '../../../../contexts/identities/infrastructure/keychain/LocalKeychain';

export type WorkspaceCallMediaEncryptionInput = {
  call: CallResource;
  communityCallKey: (
    communityId: string,
    channelId: string,
    callId: string,
  ) => Promise<CallMediaKey>;
  communityOperations: (
    communityId: string,
  ) => Promise<readonly CommunityOperation[]>;
  currentIdentityId: string;
  keychain: LocalKeychain;
};
