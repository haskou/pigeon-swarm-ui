import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentContentTypeRequiredError } from '../errors/AttachmentContentTypeRequiredError';

export class AttachmentContentType extends StringValueObject {
  public static fromString(value: string): AttachmentContentType {
    return new AttachmentContentType(value.trim());
  }

  private constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentContentTypeRequiredError());
  }
}
