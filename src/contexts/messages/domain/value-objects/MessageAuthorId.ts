import { DomainError, StringValueObject } from '@haskou/value-objects';

export class MessageAuthorId extends StringValueObject {
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

  public static fromString(value: string): MessageAuthorId {
    const normalizedValue = MessageAuthorId.normalize(value);

    if (!normalizedValue) {
      throw new DomainError('Message author id is required.');
    }

    return new MessageAuthorId(normalizedValue);
  }

  private constructor(value: string) {
    super(MessageAuthorId.normalize(value));
  }
}
