import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidNodeRegistrationCodeIdError } from '../errors/InvalidNodeRegistrationCodeIdError';

export class NodeRegistrationCodeId extends StringValueObject {
  public static fromString(value: string): NodeRegistrationCodeId {
    const trimmed = value.trim();

    assert(trimmed.length > 0, new InvalidNodeRegistrationCodeIdError());

    return new NodeRegistrationCodeId(trimmed);
  }

  private constructor(value: string) {
    super(value);
  }
}
