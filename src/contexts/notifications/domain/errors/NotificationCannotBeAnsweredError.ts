import { DomainError } from '@haskou/value-objects';

export class NotificationCannotBeAnsweredError extends DomainError {
  public constructor() {
    super('Notification cannot be answered.');
  }
}
