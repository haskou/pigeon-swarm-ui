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

export class StickerLibrary extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<StickerLibrary>,
  ): StickerLibrary {
    return new StickerLibrary(
      StickerOwnerId.fromString(primitives.ownerIdentityId),
      primitives.favoriteStickers.map(StickerUsage.fromPrimitives),
      primitives.recentStickers.map(StickerUsage.fromPrimitives),
      primitives.savedPacks.map(StickerPack.fromPrimitives),
    );
  }

  private constructor(
    private readonly ownerIdentityId: StickerOwnerId,
    private favoriteStickers: StickerUsage[],
    private recentStickers: StickerUsage[],
    private savedPacks: StickerPack[],
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
    const packId = pack.getId();

    if (this.savedPacks.some((candidate) => candidate.belongsTo(packId))) {
      return;
    }

    this.savedPacks.push(pack);
    this.record(new StickerPackSaved(this.ownerIdentityId, packId, occurredAt));
  }

  public toPrimitives() {
    return {
      favoriteStickers: this.favoriteStickers.map((usage) =>
        usage.toPrimitives(),
      ),
      ownerIdentityId: this.ownerIdentityId.toString(),
      recentStickers: this.recentStickers.map((usage) => usage.toPrimitives()),
      savedPacks: this.savedPacks.map((pack) => pack.toPrimitives()),
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
    const packs = this.savedPacks.filter((pack) => !pack.belongsTo(packId));

    if (packs.length === this.savedPacks.length) return;

    this.savedPacks = packs;
    this.record(
      new StickerPackUnsaved(this.ownerIdentityId, packId, occurredAt),
    );
  }
}
