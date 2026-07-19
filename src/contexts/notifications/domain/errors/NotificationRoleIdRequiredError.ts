import { DomainError } from '@haskou/value-objects';

export class NotificationRoleIdRequiredError extends DomainError {
  public constructor() {
    super('Notification role id is required.');
  }
}
