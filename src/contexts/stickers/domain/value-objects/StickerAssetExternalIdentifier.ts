import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidStickerAssetExternalIdentifierError } from '../errors/InvalidStickerAssetExternalIdentifierError';

export class StickerAssetExternalIdentifier extends StringValueObject {
  public static fromString(value: string): StickerAssetExternalIdentifier {
    const identifier = value.trim();

    assert(
      identifier.length > 0,
      new InvalidStickerAssetExternalIdentifierError(),
    );

    return new StickerAssetExternalIdentifier(identifier);
  }

  private constructor(value: string) {
    super(value);
  }
}
