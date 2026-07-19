import { DomainError } from '@haskou/value-objects';

export class NotificationScopeIdentifierRequiredError extends DomainError {
  public constructor() {
    super('Notification setting scope identifier is required.');
  }
}
