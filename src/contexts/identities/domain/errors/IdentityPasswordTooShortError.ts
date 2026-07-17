import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordTooShortError extends DomainError {
  public constructor() {
    super('Identity password must contain at least 20 characters.');
  }
}
