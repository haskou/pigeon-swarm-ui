import { StringValueObject, assert } from '@haskou/value-objects';

import { InvalidPollVoterIdError } from '../errors/InvalidPollVoterIdError';

export class PollVoterId extends StringValueObject {
  private static normalize(value: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue.includes('-----BEGIN PUBLIC KEY-----')) {
      return trimmedValue;
    }

    return trimmedValue
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s+/g, '');
  }

  public static fromString(value: string): PollVoterId {
    const normalizedValue = PollVoterId.normalize(value);

    assert(normalizedValue.length > 0, new InvalidPollVoterIdError());

    return new PollVoterId(normalizedValue);
  }

  private constructor(value: string) {
    super(PollVoterId.normalize(value));
  }
}
