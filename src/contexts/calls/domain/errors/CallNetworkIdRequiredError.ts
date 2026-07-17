import { DomainError } from '@haskou/value-objects';

export class CallNetworkIdRequiredError extends DomainError {
  public constructor() {
    super('Call network id is required.');
  }
}
