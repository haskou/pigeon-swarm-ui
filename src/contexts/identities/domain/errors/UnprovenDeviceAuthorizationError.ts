import { DomainError } from '@haskou/value-objects';

/**
 * The served transitions neither prove that this device is still authorized
 * nor that it was removed above its local checkpoint.
 */
export class UnprovenDeviceAuthorizationError extends DomainError {
  public constructor() {
    super('The device authorization could not be proven.');
  }
}
