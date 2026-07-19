import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { StickerUsage } from './entities/StickerUsage';
import { StickerFavorited } from './events/StickerFavorited';
import { StickerPackSaved } from './events/StickerPackSaved';
import { StickerPackUnsaved } from './events/StickerPackUnsaved';
import { StickerUnfavorited } from './events/StickerUnfavorited';
import { StickerUsed } from './events/StickerUsed';
import { StickerPack } from './StickerPack';
import { StickerId } from './value-objects/StickerId';
import { StickerOwnerId } from './value-objects/StickerOwnerId';
import { StickerPackId } from './value-objects/StickerPackId';
import { StickerPacks } from './value-objects/StickerPacks';

export class StickerLibrary extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<StickerLibrary>,
  ): StickerLibrary {
    return new StickerLibrary(
      StickerOwnerId.fromString(primitives.ownerIdentityId),
      primitives.favoriteStickers.map(StickerUsage.fromPrimitives),
      primitives.recentStickers.map(StickerUsage.fromPrimitives),
      StickerPacks.fromArray(
        primitives.savedPacks.map(StickerPack.fromPrimitives),
      ),
    );
  }

  private constructor(
    private readonly ownerIdentityId: StickerOwnerId,
    private favoriteStickers: StickerUsage[],
    private recentStickers: StickerUsage[],
    private readonly savedPacks: StickerPacks,
  ) {
    super();
  }

  public favorite(
    pack: StickerPack,
    stickerId: StickerId,
    occurredAt: Timestamp,
  ): void {
    const packId = pack.getId();

    if (
      this.favoriteStickers.some((usage) => usage.references(packId, stickerId))
    ) {
      return;
    }

    this.favoriteStickers.push(
      StickerUsage.favorite(packId, pack.findSticker(stickerId), occurredAt),
    );
    this.record(
      new StickerFavorited(this.ownerIdentityId, packId, stickerId, occurredAt),
    );
  }

  public markUsed(
    pack: StickerPack,
    stickerId: StickerId,
    occurredAt: Timestamp,
  ): void {
    const packId = pack.getId();

    this.recentStickers = this.recentStickers.filter(
      (usage) => !usage.references(packId, stickerId),
    );
    this.recentStickers.unshift(
      StickerUsage.recentlyUsed(
        packId,
        pack.findSticker(stickerId),
        occurredAt,
      ),
    );
    this.record(
      new StickerUsed(this.ownerIdentityId, packId, stickerId, occurredAt),
    );
  }

  public save(pack: StickerPack, occurredAt: Timestamp): void {
    if (!this.savedPacks.save(pack)) return;

    const packId = pack.getId();
    this.record(new StickerPackSaved(this.ownerIdentityId, packId, occurredAt));
  }

  public toPrimitives() {
    return {
      favoriteStickers: this.favoriteStickers.map((usage) =>
        usage.toPrimitives(),
      ),
      ownerIdentityId: this.ownerIdentityId.toString(),
      recentStickers: this.recentStickers.map((usage) => usage.toPrimitives()),
      savedPacks: this.savedPacks.toArray().map((pack) => pack.toPrimitives()),
    };
  }

  public unfavorite(
    packId: StickerPackId,
    stickerId: StickerId,
    occurredAt: Timestamp,
  ): void {
    const favorites = this.favoriteStickers.filter(
      (usage) => !usage.references(packId, stickerId),
    );

    if (favorites.length === this.favoriteStickers.length) return;

    this.favoriteStickers = favorites;
    this.record(
      new StickerUnfavorited(
        this.ownerIdentityId,
        packId,
        stickerId,
        occurredAt,
      ),
    );
  }

  public unsave(packId: StickerPackId, occurredAt: Timestamp): void {
    if (!this.savedPacks.unsave(packId)) return;

    this.record(
      new StickerPackUnsaved(this.ownerIdentityId, packId, occurredAt),
    );
  }
}
