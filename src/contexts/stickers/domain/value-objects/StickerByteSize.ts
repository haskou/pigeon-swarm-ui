import { Integer, assert } from '@haskou/value-objects';

import { InvalidStickerByteSizeError } from '../errors/InvalidStickerByteSizeError';

export class StickerByteSize extends Integer {
  public constructor(value: number) {
    assert(value >= 0, new InvalidStickerByteSizeError());
    super(value);
  }
}
