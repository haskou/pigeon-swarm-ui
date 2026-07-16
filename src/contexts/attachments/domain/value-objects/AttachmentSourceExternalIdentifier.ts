import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentSourceIdentifierRequiredError } from '../errors/AttachmentSourceIdentifierRequiredError';

export class AttachmentSourceExternalIdentifier extends StringValueObject {
  public static fromString(value: string): AttachmentSourceExternalIdentifier {
    return new AttachmentSourceExternalIdentifier(value.trim());
  }

  private constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentSourceIdentifierRequiredError());
  }
}
