import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordNumberRequiredError extends DomainError {
  public constructor() {
    super('Identity password must contain a number.');
  }
}
