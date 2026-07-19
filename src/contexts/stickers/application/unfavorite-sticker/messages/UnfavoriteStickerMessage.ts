import { Timestamp } from '@haskou/value-objects';

import { StickerId } from '../../../domain/value-objects/StickerId';
import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';
import { StickerPackId } from '../../../domain/value-objects/StickerPackId';

export class UnfavoriteStickerMessage {
  public constructor(
    private readonly ownerIdentityId: string,
    private readonly packId: string,
    private readonly stickerId: string,
    private readonly occurredAt: number,
  ) {}

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getOwnerId(): StickerOwnerId {
    return StickerOwnerId.fromString(this.ownerIdentityId);
  }

  public getPackId(): StickerPackId {
    return StickerPackId.fromString(this.packId);
  }

  public getStickerId(): StickerId {
    return StickerId.fromString(this.stickerId);
  }
}
