import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidStickerOwnerIdError } from '../errors/InvalidStickerOwnerIdError';

export class StickerOwnerId extends StringValueObject {
  public static fromString(value: string): StickerOwnerId {
    const ownerId = value.trim();

    assert(ownerId.length > 0, new InvalidStickerOwnerIdError());

    return new StickerOwnerId(ownerId);
  }

  private constructor(value: string) {
    super(value);
  }
}
