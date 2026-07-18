import type { PrimitiveOf } from '@haskou/value-objects';

import type { StickerPack } from '../../domain/StickerPack';
import type { StickerPackResource } from './resources/StickerPackResource';

import { Sticker as StickerEntity } from '../../domain/entities/Sticker';
import { StickerPack as StickerPackAggregate } from '../../domain/StickerPack';
import { StickerMapper } from './StickerMapper';

export class StickerPackMapper {
  public constructor(private readonly stickers: StickerMapper) {}

  public fromResource(resource: StickerPackResource): StickerPack {
    return StickerPackAggregate.fromPrimitives({
      createdAt: resource.createdAt,
      id: resource.id,
      name: resource.name,
      ownerIdentityId: resource.ownerIdentityId,
      stickers: resource.stickers.map((sticker) =>
        this.stickers.fromResource(sticker).toPrimitives(),
      ),
      updatedAt: resource.updatedAt,
    });
  }

  public toCreateInput(pack: StickerPack): { name: string } {
    return { name: pack.toPrimitives().name };
  }

  public toResource(pack: StickerPack): StickerPackResource {
    const primitives: PrimitiveOf<StickerPack> = pack.toPrimitives();

    return {
      createdAt: primitives.createdAt,
      id: primitives.id,
      name: primitives.name,
      ownerIdentityId: primitives.ownerIdentityId,
      stickers: primitives.stickers.map((sticker) =>
        this.stickers.toResource(StickerEntity.fromPrimitives(sticker)),
      ),
      updatedAt: primitives.updatedAt,
    };
  }
}
