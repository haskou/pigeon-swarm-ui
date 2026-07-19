import { Timestamp } from '@haskou/value-objects';

import { StickerOwnerId } from '../../../domain/value-objects/StickerOwnerId';
import { StickerPackName } from '../../../domain/value-objects/StickerPackName';

export class CreateStickerPackMessage {
  public constructor(
    private readonly actorIdentityId: string,
    private readonly name: string,
    private readonly occurredAt: number,
  ) {}

  public getActorId(): StickerOwnerId {
    return StickerOwnerId.fromString(this.actorIdentityId);
  }

  public getName(): StickerPackName {
    return StickerPackName.fromString(this.name);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }
}
