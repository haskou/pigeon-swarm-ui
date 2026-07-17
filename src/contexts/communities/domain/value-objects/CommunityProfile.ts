import type { PrimitiveOf } from '@haskou/value-objects';

import { CommunityDescription } from './CommunityDescription';
import { CommunityMediaIdentifier } from './CommunityMediaIdentifier';
import { CommunityName } from './CommunityName';

export class CommunityProfile {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityProfile>,
  ): CommunityProfile {
    return new CommunityProfile(
      CommunityName.fromString(primitives.name),
      CommunityDescription.fromString(primitives.description),
      CommunityMediaIdentifier.fromOptional(primitives.avatar),
      CommunityMediaIdentifier.fromOptional(primitives.banner),
    );
  }

  private constructor(
    private name: CommunityName,
    private description: CommunityDescription,
    private avatar: CommunityMediaIdentifier,
    private banner: CommunityMediaIdentifier,
  ) {}

  public update(
    name: CommunityName,
    description: CommunityDescription,
    avatar: CommunityMediaIdentifier,
    banner: CommunityMediaIdentifier,
  ): void {
    this.name = name;
    this.description = description;
    this.avatar = avatar;
    this.banner = banner;
  }

  public toPrimitives() {
    return {
      avatar: this.avatar.isPresent() ? this.avatar.toString() : undefined,
      banner: this.banner.isPresent() ? this.banner.toString() : undefined,
      description: this.description.toString(),
      name: this.name.toString(),
    };
  }
}
