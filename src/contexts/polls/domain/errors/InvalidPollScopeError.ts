import { DomainError } from '@haskou/value-objects';

export class InvalidPollScopeError extends DomainError {
  public constructor() {
    super('Community channel polls require community and channel identifiers.');
  }
}
