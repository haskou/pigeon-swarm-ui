import { DomainError } from '@haskou/value-objects';

export class CallIdentityIdRequiredError extends DomainError {
  public constructor() {
    super('Call identity id is required.');
  }
}
