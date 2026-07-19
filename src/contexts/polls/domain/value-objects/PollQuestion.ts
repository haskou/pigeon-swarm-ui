import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollQuestionError } from '../errors/InvalidPollQuestionError';

const MAX_LENGTH = 200;

export class PollQuestion extends StringValueObject {
  public static fromString(value: string): PollQuestion {
    const question = value.trim();

    assert(
      question.length > 0 && question.length <= MAX_LENGTH,
      new InvalidPollQuestionError(),
    );

    return new PollQuestion(question);
  }

  private constructor(value: string) {
    super(value);
  }
}
