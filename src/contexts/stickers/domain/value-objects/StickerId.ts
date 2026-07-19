import { StringValueObject, UUID, assert } from '@haskou/value-objects';

import { InvalidStickerIdError } from '../errors/InvalidStickerIdError';

export class StickerId extends StringValueObject {
  public static fromString(value: string): StickerId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new InvalidStickerIdError());

    return new StickerId(trimmedValue);
  }

  public static generate(): StickerId {
    return new StickerId(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
