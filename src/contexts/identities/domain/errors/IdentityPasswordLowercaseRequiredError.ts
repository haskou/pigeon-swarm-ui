import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordLowercaseRequiredError extends DomainError {
  public constructor() {
    super('Identity password must contain a lowercase letter.');
  }
}
