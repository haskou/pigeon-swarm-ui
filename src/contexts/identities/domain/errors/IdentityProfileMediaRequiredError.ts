import { DomainError } from '@haskou/value-objects';

export class IdentityProfileMediaRequiredError extends DomainError {
  public constructor() {
    super('Identity profile media external identifier is required.');
  }
}
