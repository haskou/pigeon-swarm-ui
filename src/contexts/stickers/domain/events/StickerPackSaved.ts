import type { Timestamp } from '@haskou/value-objects';

import type { DomainEvent } from '../../../../shared/domain/DomainEvent';
import type { StickerOwnerId } from '../value-objects/StickerOwnerId';
import type { StickerPackId } from '../value-objects/StickerPackId';

export class StickerPackSaved implements DomainEvent {
  public readonly aggregateId: string;
  public readonly occurredAt: number;
  public readonly packId: StickerPackId;
  public readonly type = StickerPackSaved.name;

  public constructor(
    libraryOwnerId: StickerOwnerId,
    packId: StickerPackId,
    occurredAt: Timestamp,
  ) {
    this.aggregateId = libraryOwnerId.toString();
    this.packId = packId;
    this.occurredAt = occurredAt.valueOf();
  }
}
