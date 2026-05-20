import type { LoginResult } from '../../../../shared/domain/pigeonResources.types';
import type { ProfileHandle } from '../../domain/profile/profileHandle';
import type { ProfileName } from '../../domain/profile/profileName';
import type { IdentityNetworkMemberships } from '../../domain/value-objects/identityNetworkMemberships';

export interface RegisterIdentityPort {
  register(
    name: ProfileName,
    password: string,
    networks: IdentityNetworkMemberships,
    handle?: ProfileHandle,
  ): Promise<LoginResult>;
}
