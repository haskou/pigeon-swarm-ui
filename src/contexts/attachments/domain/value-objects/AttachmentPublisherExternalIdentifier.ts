import { StringValueObject, assert } from '@haskou/value-objects';

import { AttachmentPublisherIdentifierRequiredError } from '../errors/AttachmentPublisherIdentifierRequiredError';

export class AttachmentPublisherExternalIdentifier extends StringValueObject {
  public static fromString(
    value: string,
  ): AttachmentPublisherExternalIdentifier {
    return new AttachmentPublisherExternalIdentifier(value.trim());
  }

  private constructor(value: string) {
    super(value);

    assert(!this.isEmpty(), new AttachmentPublisherIdentifierRequiredError());
  }
}
