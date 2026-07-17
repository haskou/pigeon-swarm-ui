import { StringValueObject } from '@haskou/value-objects';

import { CallSignalIdRequiredError } from '../errors/CallSignalIdRequiredError';

export class CallSignalId extends StringValueObject {
  public static fromString(value: string): CallSignalId {
    const normalized = value.trim();

    if (!normalized) throw new CallSignalIdRequiredError();

    return new CallSignalId(normalized);
  }

  private constructor(value: string) {
    super(value);
  }
}
