import { Timestamp } from '@haskou/value-objects';

import { CommunityChannelId } from '../../../domain/value-objects/CommunityChannelId';
import { CommunityChannelName } from '../../../domain/value-objects/CommunityChannelName';
import { CommunityId } from '../../../domain/value-objects/CommunityId';
import { CommunityIdentityId } from '../../../domain/value-objects/CommunityIdentityId';

export class RenameCommunityChannelMessage {
  public constructor(
    private readonly communityId: string,
    private readonly channelId: string,
    private readonly name: string,
    private readonly actorIdentityId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorIdentityId(): CommunityIdentityId {
    return CommunityIdentityId.fromString(this.actorIdentityId);
  }

  public getChannelId(): CommunityChannelId {
    return CommunityChannelId.fromString(this.channelId);
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
}
