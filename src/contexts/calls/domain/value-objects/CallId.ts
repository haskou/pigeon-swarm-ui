import { StringValueObject } from '@haskou/value-objects';

import { CallIdRequiredError } from '../errors/CallIdRequiredError';

export class CallId extends StringValueObject {
  public static fromString(value: string): CallId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new CallIdRequiredError();
    }

    return new CallId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
