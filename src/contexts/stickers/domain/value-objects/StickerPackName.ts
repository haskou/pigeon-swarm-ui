import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidStickerPackNameError } from '../errors/InvalidStickerPackNameError';

export class StickerPackName extends StringValueObject {
  public static readonly MAX_LENGTH = 80;

  public static fromString(value: string): StickerPackName {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new InvalidStickerPackNameError());

    return new StickerPackName(trimmedValue);
  }

  private constructor(value: string) {
    super(value, StickerPackName.MAX_LENGTH);
  }
}
