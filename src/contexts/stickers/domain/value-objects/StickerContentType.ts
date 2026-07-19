import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidStickerContentTypeError } from '../errors/InvalidStickerContentTypeError';

export class StickerContentType extends StringValueObject {
  public static fromString(value: string): StickerContentType {
    const contentType = value.trim();

    assert(contentType.length > 0, new InvalidStickerContentTypeError());

    return new StickerContentType(contentType);
  }

  private constructor(value: string) {
    super(value);
  }
}
