import { DomainError } from '@haskou/value-objects';

export class PushSubscriptionCredentialRequiredError extends DomainError {
  public constructor() {
    super('Push subscription credential is required.');
  }
}
