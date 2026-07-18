import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { StickerId } from '../value-objects/StickerId';
import { StickerPackId } from '../value-objects/StickerPackId';
import { Sticker } from './Sticker';

export class StickerUsage {
  public static favorite(
    packId: StickerPackId,
    sticker: Sticker,
    occurredAt: Timestamp,
  ): StickerUsage {
    return new StickerUsage(packId, sticker, occurredAt, undefined);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<StickerUsage>,
  ): StickerUsage {
    return new StickerUsage(
      StickerPackId.fromString(primitives.packId),
      Sticker.fromPrimitives(primitives.sticker),
      typeof primitives.favoritedAt === 'number'
        ? new Timestamp(primitives.favoritedAt)
        : undefined,
      typeof primitives.usedAt === 'number'
        ? new Timestamp(primitives.usedAt)
        : undefined,
    );
  }

  public static recentlyUsed(
    packId: StickerPackId,
    sticker: Sticker,
    occurredAt: Timestamp,
  ): StickerUsage {
    return new StickerUsage(packId, sticker, undefined, occurredAt);
  }

  private constructor(
    private readonly packId: StickerPackId,
    private readonly sticker: Sticker,
    private readonly favoritedAt: Timestamp | undefined,
    private readonly usedAt: Timestamp | undefined,
  ) {}

  public references(packId: StickerPackId, stickerId: StickerId): boolean {
    return this.packId.isEqual(packId) && this.sticker.belongsTo(stickerId);
  }

  public toPrimitives() {
    const sticker = this.sticker.toPrimitives();

    return {
      favoritedAt: this.favoritedAt?.valueOf(),
      packId: this.packId.toString(),
      sticker,
      stickerId: sticker.id,
      usedAt: this.usedAt?.valueOf(),
    };
  }
}
