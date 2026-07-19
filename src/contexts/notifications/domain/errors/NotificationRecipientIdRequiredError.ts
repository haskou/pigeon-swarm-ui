import { DomainError } from '@haskou/value-objects';

export class NotificationRecipientIdRequiredError extends DomainError {
  public constructor() {
    super('Notification recipient identity id is required.');
  }
}
