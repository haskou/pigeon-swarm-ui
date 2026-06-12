import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { ProfileHandle } from '../../domain/profile/ProfileHandle';
import type { ProfileName } from '../../domain/profile/ProfileName';
import type { IdentityNetworkMemberships } from '../../domain/value-objects/IdentityNetworkMemberships';

export interface RegisterIdentityPort {
  register(
    name: ProfileName,
    password: string,
    networks: IdentityNetworkMemberships,
    handle?: ProfileHandle,
    options?: { passkeyPrfEnabled?: boolean },
  ): Promise<LoginResult>;
}
