import { StringValueObject, UUID, assert } from '@haskou/value-objects';

import { InvalidStickerPackIdError } from '../errors/InvalidStickerPackIdError';

export class StickerPackId extends StringValueObject {
  public static fromString(value: string): StickerPackId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new InvalidStickerPackIdError());

    return new StickerPackId(trimmedValue);
  }

  public static generate(): StickerPackId {
    return new StickerPackId(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
