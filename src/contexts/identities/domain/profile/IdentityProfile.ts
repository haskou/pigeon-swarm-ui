import type { PrimitiveOf } from '@haskou/value-objects';

import { IdentityProfileMediaExternalIdentifier } from '../value-objects/IdentityProfileMediaExternalIdentifier';
import { ProfileBiography } from './ProfileBiography';
import { ProfileHandle } from './ProfileHandle';
import { ProfileName } from './ProfileName';

export class IdentityProfile {
  public static fromPrimitives(
    profile: PrimitiveOf<IdentityProfile>,
  ): IdentityProfile {
    return new IdentityProfile(
      ProfileName.fromString(profile.name),
      profile.handle ? ProfileHandle.fromString(profile.handle) : undefined,
      profile.biography
        ? ProfileBiography.fromString(profile.biography)
        : undefined,
      profile.picture
        ? IdentityProfileMediaExternalIdentifier.fromString(profile.picture)
        : undefined,
      profile.banner
        ? IdentityProfileMediaExternalIdentifier.fromString(profile.banner)
        : undefined,
    );
  }

  // prettier-ignore
  private constructor(
    private readonly name: ProfileName,
    private readonly handle?: ProfileHandle,
    private readonly biography?: ProfileBiography,
    private readonly picture?: IdentityProfileMediaExternalIdentifier,
    private readonly banner?: IdentityProfileMediaExternalIdentifier,
  ) {
  }

  public isEqual(profile: IdentityProfile): boolean {
    const optionalEqual = <T extends { isEqual(other: T): boolean }>(
      left: T | undefined,
      right: T | undefined,
    ): boolean => {
      if (!left || !right) return left === right;

      return left.isEqual(right);
    };

    return (
      this.name.isEqual(profile.name) &&
      optionalEqual(this.handle, profile.handle) &&
      optionalEqual(this.biography, profile.biography) &&
      optionalEqual(this.picture, profile.picture) &&
      optionalEqual(this.banner, profile.banner)
    );
  }

  public toPrimitives() {
    return {
      banner: this.banner?.toString(),
      biography: this.biography?.toString(),
      handle: this.handle?.toString(),
      name: this.name.toString(),
      picture: this.picture?.toString(),
    };
  }
}
