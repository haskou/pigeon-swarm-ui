import { assert, Integer } from '@haskou/value-objects';

import { AttachmentByteSizeCannotBeNegativeError } from '../errors/AttachmentByteSizeCannotBeNegativeError';

export class AttachmentByteSize extends Integer {
  public static fromBytes(bytes: number): AttachmentByteSize {
    return new AttachmentByteSize(bytes);
  }

  private constructor(bytes: number) {
    super(bytes);
    assert(
      this.isGreaterOrEqualThan(0),
      new AttachmentByteSizeCannotBeNegativeError(),
    );
  }

  public fitsWithin(limit: AttachmentByteSize): boolean {
    return this.isLessOrEqualThan(limit);
  }
}
