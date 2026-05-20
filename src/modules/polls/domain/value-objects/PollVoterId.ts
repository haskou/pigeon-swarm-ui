import { DomainError, StringValueObject } from '@haskou/value-objects';

export class PollVoterId extends StringValueObject {
  private constructor(value: string) {
    super(PollVoterId.normalize(value));
  }

  public static fromString(value: string): PollVoterId {
    const normalizedValue = PollVoterId.normalize(value);

    if (!normalizedValue) {
      throw new DomainError('Poll voter id is required.');
    }

    return new PollVoterId(normalizedValue);
  }

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
}
