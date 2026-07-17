import type { PrimitiveOf } from '@haskou/value-objects';

import { CommunityVisibility } from './CommunityVisibility';

export class CommunityPublicationSettings {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityPublicationSettings>,
  ): CommunityPublicationSettings {
    const visibility = CommunityVisibility.fromPrimitives(
      primitives.visibility,
    );

    return new CommunityPublicationSettings(
      visibility,
      primitives.discoverable,
      visibility.isPublic() && primitives.autoJoinEnabled,
    );
  }

  private constructor(
    private readonly visibility: CommunityVisibility,
    private discoverable: boolean,
    private autoJoinEnabled: boolean,
  ) {}

  public toPrimitives() {
    return {
      autoJoinEnabled: this.autoJoinEnabled,
      discoverable: this.discoverable,
      visibility: this.visibility.valueOf(),
    };
  }
}
