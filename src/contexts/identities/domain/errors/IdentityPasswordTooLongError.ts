import { DomainError } from '@haskou/value-objects';

export class IdentityPasswordTooLongError extends DomainError {
  public constructor() {
    super('Identity password cannot contain more than 256 characters.');
  }
}
