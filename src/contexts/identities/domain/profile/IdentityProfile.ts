import type { IdentityProfile as IdentityProfilePrimitives } from '../../../../shared/domain/pigeonResources.types';

import { ProfileBiography } from './ProfileBiography';
import { ProfileHandle } from './ProfileHandle';
import { ProfileName } from './ProfileName';

export class IdentityProfile {
  // prettier-ignore
  private constructor(
    private readonly name: ProfileName,
    private readonly handle?: ProfileHandle,
    private readonly biography?: ProfileBiography,
  ) {
  }

  public static fromPrimitives(
    profile: IdentityProfilePrimitives,
  ): IdentityProfile {
    return new IdentityProfile(
      ProfileName.fromString(profile.name),
      profile.handle ? ProfileHandle.fromString(profile.handle) : undefined,
      profile.biography
        ? ProfileBiography.fromString(profile.biography)
        : undefined,
    );
  }

  public getHandle(): ProfileHandle | undefined {
    return this.handle;
  }

  public getName(): ProfileName {
    return this.name;
  }

  public rename(name: ProfileName): IdentityProfile {
    return new IdentityProfile(name, this.handle, this.biography);
  }

  public toPrimitives(): IdentityProfilePrimitives {
    return {
      biography: this.biography?.toString(),
      handle: this.handle?.toString(),
      name: this.name.toString(),
    };
  }
}
