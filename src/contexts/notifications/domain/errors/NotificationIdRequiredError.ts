import { DomainError } from '@haskou/value-objects';

export class NotificationIdRequiredError extends DomainError {
  public constructor() {
    super('Notification id is required.');
  }
}
