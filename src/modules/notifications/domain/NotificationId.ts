import { DomainError, StringValueObject } from '@haskou/value-objects';

export class NotificationId extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }

  public static fromString(value: string): NotificationId {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new DomainError('Notification id is required.');
    }

    return new NotificationId(trimmedValue);
  }
}
