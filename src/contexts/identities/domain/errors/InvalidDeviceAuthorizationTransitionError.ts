import { DomainError } from '@haskou/value-objects';

export class InvalidDeviceAuthorizationTransitionError extends DomainError {
  public constructor() {
    super('Invalid device authorization transition.');
  }
}
