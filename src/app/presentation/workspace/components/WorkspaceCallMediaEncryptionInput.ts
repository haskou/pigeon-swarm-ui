import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type {
  Community,
  LocalKeychain,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceCallMediaEncryptionInput = {
  call: CallResource;
  communities: Community[];
  currentIdentityId: string;
  communityCallKey: (communityId: string, callId: string) => Promise<string>;
  enabled: boolean;
  keychain: LocalKeychain;
};
