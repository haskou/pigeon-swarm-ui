import { assert, type PrimitiveOf } from '@haskou/value-objects';

import { InvalidStickerDimensionsError } from '../errors/InvalidStickerDimensionsError';

export class StickerDimensions {
  public static fromPrimitives(
    primitives: PrimitiveOf<StickerDimensions>,
  ): StickerDimensions {
    return StickerDimensions.create(primitives.width, primitives.height);
  }

  public static create(width: number, height: number): StickerDimensions {
    assert(width > 0 && height > 0, new InvalidStickerDimensionsError());

    return new StickerDimensions(width, height);
  }

  private constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  public toPrimitives() {
    return { height: this.height, width: this.width };
  }
}
