import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentExternalIdentifierRequiredError } from '../errors/AttachmentExternalIdentifierRequiredError';

export class AttachmentExternalIdentifier extends StringValueObject {
  public static fromString(value: string): AttachmentExternalIdentifier {
    return new AttachmentExternalIdentifier(value.trim());
  }

  public constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentExternalIdentifierRequiredError());
  }
}
