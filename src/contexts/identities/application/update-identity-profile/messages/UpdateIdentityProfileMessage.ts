import { Timestamp } from '@haskou/value-objects';

import { IdentityProfile } from '../../../domain/profile/IdentityProfile';
import { IdentityId } from '../../../domain/value-objects/IdentityId';
import { IdentityNetworkMemberships } from '../../../domain/value-objects/IdentityNetworkMemberships';

export class UpdateIdentityProfileMessage {
  public constructor(
    private readonly input: {
      actorIdentityId: string;
      banner?: string;
      biography?: string;
      handle?: string;
      name: string;
      networkIds: string[];
      occurredAt: number;
      picture?: string;
    },
  ) {}

  private optional(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
  }

  public getActorIdentityId(): IdentityId {
    return IdentityId.fromString(this.input.actorIdentityId);
  }

  public getNetworkMemberships(): IdentityNetworkMemberships {
    return IdentityNetworkMemberships.fromPrimitives(this.input.networkIds);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.input.occurredAt);
  }

  public getProfile(): IdentityProfile {
    return IdentityProfile.fromPrimitives({
      banner: this.optional(this.input.banner),
      biography: this.optional(this.input.biography),
      handle: this.optional(this.input.handle),
      name: this.input.name.trim(),
      picture: this.optional(this.input.picture),
    });
  }
}
