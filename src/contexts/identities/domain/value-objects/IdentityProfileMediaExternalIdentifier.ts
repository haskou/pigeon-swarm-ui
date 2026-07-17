import { StringValueObject, assert } from '@haskou/value-objects';

import { IdentityProfileMediaRequiredError } from '../errors/IdentityProfileMediaRequiredError';

export class IdentityProfileMediaExternalIdentifier extends StringValueObject {
  public static fromString(
    value: string,
  ): IdentityProfileMediaExternalIdentifier {
    return new IdentityProfileMediaExternalIdentifier(value.trim());
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new IdentityProfileMediaRequiredError());
  }
}
