import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentIdRequiredError } from '../errors/AttachmentIdRequiredError';

export class AttachmentId extends StringValueObject {
  public static fromString(value: string): AttachmentId {
    return new AttachmentId(value.trim());
  }

  private constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentIdRequiredError());
  }
}
