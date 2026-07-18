import type { PrimitiveOf } from '@haskou/value-objects';

import type { StickerLibrary } from '../../domain/StickerLibrary';
import type { StickerOwnerId } from '../../domain/value-objects/StickerOwnerId';
import type { MyStickersResource } from './resources/MyStickersResource';
import type { StickerUsageResource } from './resources/StickerUsageResource';

import { Sticker as StickerEntity } from '../../domain/entities/Sticker';
import { StickerLibrary as StickerLibraryAggregate } from '../../domain/StickerLibrary';
import { StickerPack as StickerPackAggregate } from '../../domain/StickerPack';
import { StickerMapper } from './StickerMapper';
import { StickerPackMapper } from './StickerPackMapper';

export class StickerLibraryMapper {
  public constructor(
    private readonly packs: StickerPackMapper,
    private readonly stickers: StickerMapper,
  ) {}

  private usageFromResource(resource: StickerUsageResource) {
    return {
      favoritedAt: resource.favoritedAt,
      packId: resource.packId,
      sticker: this.stickers.fromResource(resource.sticker).toPrimitives(),
      stickerId: resource.stickerId,
      usedAt: resource.usedAt,
    };
  }

  private usageToResource(
    usage: PrimitiveOf<StickerLibrary>['favoriteStickers'][number],
  ): StickerUsageResource {
    return {
      favoritedAt: usage.favoritedAt,
      packId: usage.packId,
      sticker: this.stickers.toResource(
        StickerEntity.fromPrimitives(usage.sticker),
      ),
      stickerId: usage.stickerId,
      usedAt: usage.usedAt,
    };
  }

  public fromResource(
    resource: MyStickersResource,
    ownerId: StickerOwnerId,
  ): StickerLibrary {
    return StickerLibraryAggregate.fromPrimitives({
      favoriteStickers: resource.favoriteStickers.map((usage) =>
        this.usageFromResource(usage),
      ),
      ownerIdentityId: ownerId.toString(),
      recentStickers: resource.recentStickers.map((usage) =>
        this.usageFromResource(usage),
      ),
      savedPacks: resource.savedPacks.map((pack) =>
        this.packs.fromResource(pack).toPrimitives(),
      ),
    });
  }

  public toResource(library: StickerLibrary): MyStickersResource {
    const primitives: PrimitiveOf<StickerLibrary> = library.toPrimitives();

    return {
      favoriteStickers: primitives.favoriteStickers.map((usage) =>
        this.usageToResource(usage),
      ),
      recentStickers: primitives.recentStickers.map((usage) =>
        this.usageToResource(usage),
      ),
      savedPacks: primitives.savedPacks.map((pack) =>
        this.packs.toResource(StickerPackAggregate.fromPrimitives(pack)),
      ),
    };
  }
}
