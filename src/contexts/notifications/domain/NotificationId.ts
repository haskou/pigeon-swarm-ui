import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NotificationId extends StringValueObject {
  public static fromString(value: string): NotificationId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Notification id is required.');
    }

    return new NotificationId(trimmedValue);
  }

  private constructor(value: string) {
    super(value);
  }
}
