import { DomainError } from '@haskou/value-objects';

export class NotificationNotFoundError extends DomainError {
  public constructor() {
    super('Notification was not found.');
  }
}
