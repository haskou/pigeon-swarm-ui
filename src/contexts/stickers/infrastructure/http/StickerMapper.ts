import type { Sticker } from '../../domain/entities/Sticker';
import type { StickerInput } from './resources/StickerInput';
import type { StickerResource } from './resources/StickerResource';

import { Sticker as StickerEntity } from '../../domain/entities/Sticker';

export class StickerMapper {
  public fromResource(resource: StickerResource): Sticker {
    return StickerEntity.fromPrimitives({
      createdAt: resource.createdAt,
      definition: {
        assetExternalIdentifier: resource.assetCid,
        contentType: resource.contentType,
        dimensions: resource.dimensions,
        sizeBytes: resource.sizeBytes,
        type: resource.type,
      },
      id: resource.id,
      updatedAt: resource.updatedAt,
    });
  }

  public toInput(sticker: Sticker): StickerInput {
    const primitives = sticker.toPrimitives();

    return {
      assetCid: primitives.definition.assetExternalIdentifier,
      contentType: primitives.definition.contentType,
      dimensions: primitives.definition.dimensions!,
      sizeBytes: primitives.definition.sizeBytes!,
      type: primitives.definition.type as StickerInput['type'],
    };
  }

  public toResource(sticker: Sticker): StickerResource {
    const primitives = sticker.toPrimitives();

    return {
      assetCid: primitives.definition.assetExternalIdentifier,
      contentType: primitives.definition.contentType,
      createdAt: primitives.createdAt,
      dimensions: primitives.definition.dimensions,
      id: primitives.id,
      sizeBytes: primitives.definition.sizeBytes,
      type: primitives.definition.type as StickerResource['type'],
      updatedAt: primitives.updatedAt,
    };
  }
}
