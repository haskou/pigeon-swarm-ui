import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordSymbolRequiredError extends DomainError {
  public constructor() {
    super('Identity password must contain a symbol.');
  }
}
