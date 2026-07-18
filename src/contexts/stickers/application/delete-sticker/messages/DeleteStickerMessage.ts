import { Timestamp } from '@haskou/value-objects';

import { StickerId } from '../../../domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../domain/value-objects/StickerPackId';

export class DeleteStickerMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly packId: string,
    private readonly stickerId: string,
    private readonly occurredAt: number,
  ) {}

  public getActorId(): StickerOwnerId {
    return StickerOwnerId.fromString(this.actorIdentityId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getPackId(): StickerPackId {
    return StickerPackId.fromString(this.packId);
  }

  public getStickerId(): StickerId {
    return StickerId.fromString(this.stickerId);
  }
}
