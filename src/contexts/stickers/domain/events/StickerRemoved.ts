import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { StickerId } from '../value-objects/StickerId';
import type { StickerPackId } from '../value-objects/StickerPackId';

export class StickerRemoved implements DomainEvent {
  public readonly aggregateId: string;
  public readonly occurredAt: number;
  public readonly stickerId: StickerId;
  public readonly type = StickerRemoved.name;

  public constructor(
    packId: StickerPackId,
    stickerId: StickerId,
    occurredAt: Timestamp,
  ) {
    this.aggregateId = packId.toString();
    this.stickerId = stickerId;
    this.occurredAt = occurredAt.valueOf();
  }
}
