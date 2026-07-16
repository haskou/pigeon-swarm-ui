import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentFilenameRequiredError } from '../errors/AttachmentFilenameRequiredError';

export class AttachmentFilename extends StringValueObject {
  public static fromString(value: string): AttachmentFilename {
    return new AttachmentFilename(value.trim());
  }

  private constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentFilenameRequiredError());
  }
}
