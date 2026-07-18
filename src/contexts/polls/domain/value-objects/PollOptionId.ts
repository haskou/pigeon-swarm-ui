import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollOptionIdError } from '../errors/InvalidPollOptionIdError';

export class PollOptionId extends StringValueObject {
  public static fromString(value: string): PollOptionId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new InvalidPollOptionIdError());

    return new PollOptionId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
