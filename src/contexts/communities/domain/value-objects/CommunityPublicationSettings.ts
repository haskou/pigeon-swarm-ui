import type { PrimitiveOf } from '@haskou/value-objects';

import { CommunityVisibility } from './CommunityVisibility';

export class CommunityPublicationSettings {
  public static fromPrimitives(
    primitives: PrimitiveOf<CommunityPublicationSettings>,
  ): CommunityPublicationSettings {
    return new CommunityPublicationSettings(
      CommunityVisibility.fromPrimitives(primitives.visibility),
      primitives.discoverable,
      primitives.autoJoinEnabled,
    );
  }

  private constructor(
    private readonly visibility: CommunityVisibility,
    private discoverable: boolean,
    private autoJoinEnabled: boolean,
  ) {}

  public change(discoverable: boolean, autoJoinEnabled: boolean): void {
    this.discoverable = discoverable;
    this.autoJoinEnabled = this.visibility.isPublic() && autoJoinEnabled;
  }

  public isPrivate(): boolean {
    return this.visibility.isPrivate();
  }

  public isPublic(): boolean {
    return this.visibility.isPublic();
  }

  public toPrimitives() {
    return {
      autoJoinEnabled: this.autoJoinEnabled,
      discoverable: this.discoverable,
      visibility: this.visibility.valueOf(),
    };
  }
}
