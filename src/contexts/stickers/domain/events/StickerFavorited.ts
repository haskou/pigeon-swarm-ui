import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { StickerId } from '../value-objects/StickerId';
import type { StickerOwnerId } from '../value-objects/StickerOwnerId';
import type { StickerPackId } from '../value-objects/StickerPackId';

export class StickerFavorited implements DomainEvent {
  public readonly aggregateId: string;
  public readonly occurredAt: number;
  public readonly packId: StickerPackId;
  public readonly stickerId: StickerId;
  public readonly type = StickerFavorited.name;

  public constructor(
    libraryOwnerId: StickerOwnerId,
    packId: StickerPackId,
    stickerId: StickerId,
    occurredAt: Timestamp,
  ) {
    this.aggregateId = libraryOwnerId.toString();
    this.packId = packId;
    this.stickerId = stickerId;
    this.occurredAt = occurredAt.valueOf();
  }
}
