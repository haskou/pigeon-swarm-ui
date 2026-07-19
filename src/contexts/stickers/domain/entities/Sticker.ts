import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { StickerDefinition } from '../value-objects/StickerDefinition';
import { StickerId } from '../value-objects/StickerId';

export class Sticker {
  public static create(
    definition: StickerDefinition,
    occurredAt: Timestamp,
  ): Sticker {
    return new Sticker(
      StickerId.generate(),
      definition,
      occurredAt,
      occurredAt,
    );
  }

  public static fromPrimitives(primitives: PrimitiveOf<Sticker>): Sticker {
    return new Sticker(
      StickerId.fromString(primitives.id),
      StickerDefinition.fromPrimitives(primitives.definition),
      typeof primitives.createdAt === 'number'
        ? new Timestamp(primitives.createdAt)
        : undefined,
      typeof primitives.updatedAt === 'number'
        ? new Timestamp(primitives.updatedAt)
        : undefined,
    );
  }

  public static update(
    id: StickerId,
    definition: StickerDefinition,
    occurredAt: Timestamp,
  ): Sticker {
    return new Sticker(id, definition, undefined, occurredAt);
  }

  public constructor(
    private readonly id: StickerId,
    private readonly definition: StickerDefinition,
    private readonly createdAt: Timestamp | undefined,
    private readonly updatedAt: Timestamp | undefined,
  ) {}

  public belongsTo(id: StickerId): boolean {
    return this.id.isEqual(id);
  }

  public getId(): StickerId {
    return this.id;
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt?.valueOf(),
      definition: this.definition.toPrimitives(),
      id: this.id.toString(),
      updatedAt: this.updatedAt?.valueOf(),
    };
  }
}
