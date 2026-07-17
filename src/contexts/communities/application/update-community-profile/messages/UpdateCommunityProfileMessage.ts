import { Timestamp } from '@haskou/value-objects';

import { CommunityDescription } from '../../../domain/value-objects/CommunityDescription';
import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';
import { CommunityMediaIdentifier } from '../../../domain/value-objects/CommunityMediaIdentifier';
import { CommunityName } from '../../../domain/value-objects/CommunityName';

export class UpdateCommunityProfileMessage {
  public constructor(
    private readonly communityId: string,
    private readonly actorIdentityId: string,
    private readonly name: string,
    private readonly description: string,
    private readonly avatar: null | string | undefined,
    private readonly banner: null | string | undefined,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getAvatar(): CommunityMediaIdentifier {
    return CommunityMediaIdentifier.fromOptional(this.avatar);
  }

  public getBanner(): CommunityMediaIdentifier {
    return CommunityMediaIdentifier.fromOptional(this.banner);
  }

  public getCommunityId(): CommunityId {
    return CommunityId.fromString(this.communityId);
  }

  public getDescription(): CommunityDescription {
    return CommunityDescription.fromString(this.description);
  }

  public getName(): CommunityName {
    return CommunityName.fromString(this.name);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
