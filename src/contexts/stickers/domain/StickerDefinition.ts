import type { PrimitiveOf } from '@haskou/value-objects';

import { StickerDimensions } from './StickerDimensions';
import { StickerType } from './StickerType';
import { StickerAssetExternalIdentifier } from './value-objects/StickerAssetExternalIdentifier';
import { StickerByteSize } from './value-objects/StickerByteSize';
import { StickerContentType } from './value-objects/StickerContentType';

export class StickerDefinition {
  public static create(
    assetExternalIdentifier: StickerAssetExternalIdentifier,
    contentType: StickerContentType,
    dimensions: StickerDimensions,
    size: StickerByteSize,
    type: StickerType,
  ): StickerDefinition {
    return new StickerDefinition(
      assetExternalIdentifier,
      contentType,
      dimensions,
      size,
      type,
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<StickerDefinition>,
  ): StickerDefinition {
    return new StickerDefinition(
      StickerAssetExternalIdentifier.fromString(
        primitives.assetExternalIdentifier,
      ),
      StickerContentType.fromString(primitives.contentType),
      primitives.dimensions
        ? StickerDimensions.fromPrimitives(primitives.dimensions)
        : undefined,
      typeof primitives.sizeBytes === 'number'
        ? new StickerByteSize(primitives.sizeBytes)
        : undefined,
      StickerType.fromPrimitives(primitives.type),
    );
  }

  private constructor(
    private readonly assetExternalIdentifier: StickerAssetExternalIdentifier,
    private readonly contentType: StickerContentType,
    private readonly dimensions: StickerDimensions | undefined,
    private readonly sizeBytes: StickerByteSize | undefined,
    private readonly type: StickerType,
  ) {}

  public toPrimitives() {
    return {
      assetExternalIdentifier: this.assetExternalIdentifier.toString(),
      contentType: this.contentType.toString(),
      dimensions: this.dimensions?.toPrimitives(),
      sizeBytes: this.sizeBytes?.valueOf(),
      type: this.type.valueOf(),
    };
  }
}
