import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidIdentityRegistrationCodeError } from '../errors/InvalidIdentityRegistrationCodeError';

const PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The one-time code a node owner hands out to admit a new identity. */
export class IdentityRegistrationCode extends StringValueObject {
  public static fromString(value: string): IdentityRegistrationCode {
    return new IdentityRegistrationCode(value.trim());
  }

  private constructor(value: string) {
    assert(PATTERN.test(value), new InvalidIdentityRegistrationCodeError());
    super(value);
  }
}
