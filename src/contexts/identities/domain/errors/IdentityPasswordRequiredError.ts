import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordRequiredError extends DomainError {
  public constructor() {
    super('Identity password is required.');
  }
}
