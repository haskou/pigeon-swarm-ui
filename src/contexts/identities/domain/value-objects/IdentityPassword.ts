import { StringValueObject, assert } from '@haskou/value-objects';

import { IdentityPasswordLowercaseRequiredError } from '../errors/IdentityPasswordLowercaseRequiredError';
import { IdentityPasswordNumberRequiredError } from '../errors/IdentityPasswordNumberRequiredError';
import { IdentityPasswordRequiredError } from '../errors/IdentityPasswordRequiredError';
import { IdentityPasswordSymbolRequiredError } from '../errors/IdentityPasswordSymbolRequiredError';
import { IdentityPasswordTooLongError } from '../errors/IdentityPasswordTooLongError';
import { IdentityPasswordTooShortError } from '../errors/IdentityPasswordTooShortError';
import { IdentityPasswordUppercaseRequiredError } from '../errors/IdentityPasswordUppercaseRequiredError';

const minimumLength = 20;
const maximumLength = 256;

export class IdentityPassword extends StringValueObject {
  public static fromString(value: string): IdentityPassword {
    return new IdentityPassword(value);
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new IdentityPasswordRequiredError());
  }

  public assertStrong(): void {
    assert(
      this.value.length >= minimumLength,
      new IdentityPasswordTooShortError(),
    );
    assert(
      this.value.length <= maximumLength,
      new IdentityPasswordTooLongError(),
    );
    assert(
      /[A-Z]/.test(this.value),
      new IdentityPasswordUppercaseRequiredError(),
    );
    assert(
      /[a-z]/.test(this.value),
      new IdentityPasswordLowercaseRequiredError(),
    );
    assert(/[0-9]/.test(this.value), new IdentityPasswordNumberRequiredError());
    assert(
      /[^A-Za-z0-9]/.test(this.value),
      new IdentityPasswordSymbolRequiredError(),
    );
  }
}
