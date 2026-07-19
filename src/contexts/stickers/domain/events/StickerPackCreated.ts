import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { StickerPackId } from '../value-objects/StickerPackId';

export class StickerPackCreated implements DomainEvent {
  public readonly aggregateId: string;
  public readonly occurredAt: number;
  public readonly type = StickerPackCreated.name;

  public constructor(packId: StickerPackId, occurredAt: Timestamp) {
    this.aggregateId = packId.toString();
    this.occurredAt = occurredAt.valueOf();
  }
}
