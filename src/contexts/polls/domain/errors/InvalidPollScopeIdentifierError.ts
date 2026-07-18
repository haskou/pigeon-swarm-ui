import { DomainError } from '@haskou/value-objects';

export class InvalidPollScopeIdentifierError extends DomainError {
  public constructor() {
    super('Poll scope identifier is required.');
  }
}
