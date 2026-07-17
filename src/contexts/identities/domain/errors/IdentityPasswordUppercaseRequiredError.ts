import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordUppercaseRequiredError extends DomainError {
  public constructor() {
    super('Identity password must contain an uppercase letter.');
  }
}
