import { Timestamp } from '@haskou/value-objects';

import { CommunityChannelName } from '../../../domain/value-objects/CommunityChannelName';
import { CommunityChannelType } from '../../../domain/value-objects/CommunityChannelType';
import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';

export class CreateCommunityChannelMessage {
  public constructor(
    private readonly communityId: string,
    private readonly name: string,
    private readonly type: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getCommunityId(): CommunityId {
    return CommunityId.fromString(this.communityId);
  }

  public getName(): CommunityChannelName {
    return CommunityChannelName.fromString(this.name);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getType(): CommunityChannelType {
    return CommunityChannelType.fromPrimitives(this.type);
  }
}
