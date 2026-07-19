import { DomainError } from '@haskou/value-objects';

export class PushSubscriptionEndpointRequiredError extends DomainError {
  public constructor() {
    super('Push subscription endpoint is required.');
  }
}
