import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollOptionTextError } from '../errors/InvalidPollOptionTextError';

const MAX_LENGTH = 120;

export class PollOptionText extends StringValueObject {
  public static fromString(value: string): PollOptionText {
    const text = value.trim();

    assert(
      text.length > 0 && text.length <= MAX_LENGTH,
      new InvalidPollOptionTextError(),
    );

    return new PollOptionText(text);
  }

  private constructor(value: string) {
    super(value);
  }
}
