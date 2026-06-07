import { DomainError, StringValueObject } from '@haskou/value-objects';

export class MessageReactionEmoji extends StringValueObject {
  public static fromString(value: string): MessageReactionEmoji {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Message reaction emoji is required.');
    }

    return new MessageReactionEmoji(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
