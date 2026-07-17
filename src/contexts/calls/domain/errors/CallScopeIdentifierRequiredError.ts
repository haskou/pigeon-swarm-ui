import { DomainError } from '@haskou/value-objects';

export class CallScopeIdentifierRequiredError extends DomainError {
  public constructor() {
    super('Call scope identifier is required.');
  }
}
