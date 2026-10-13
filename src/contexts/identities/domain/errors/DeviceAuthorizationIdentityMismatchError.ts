import { DomainError } from '@haskou/value-objects';

export class DeviceAuthorizationIdentityMismatchError extends DomainError {
  public constructor() {
    super('Device authorization identity does not match.');
  }
}
