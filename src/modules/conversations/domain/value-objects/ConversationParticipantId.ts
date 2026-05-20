import { DomainError, StringValueObject } from '@haskou/value-objects';

export class ConversationParticipantId extends StringValueObject {
  private constructor(value: string) {
    super(ConversationParticipantId.normalize(value));
  }

  public static fromString(value: string): ConversationParticipantId {
    const normalizedValue = ConversationParticipantId.normalize(value);

    if (!normalizedValue) {
      throw new DomainError('Conversation participant id is required.');
    }

    return new ConversationParticipantId(normalizedValue);
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
