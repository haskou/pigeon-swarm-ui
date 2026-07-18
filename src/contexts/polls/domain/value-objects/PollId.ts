import { StringValueObject, UUID, assert } from '@haskou/value-objects';

import { InvalidPollIdError } from '../errors/InvalidPollIdError';

export class PollId extends StringValueObject {
  public static fromString(value: string): PollId {
    const trimmedValue = value.trim();

    assert(trimmedValue.length > 0, new InvalidPollIdError());

    return new PollId(trimmedValue);
  }

  public static generate(): PollId {
    return new PollId(UUID.generate().toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
