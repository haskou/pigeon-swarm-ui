import { DomainError } from '@haskou/value-objects';

/**
 * The signed transitions do not authorize the device that published a
 * device-sealed secret at the revision the secret names, so the secret is
 * not opened however validly that device signed it.
 */
export class UnauthorizedDeviceSealedSecretPublisherError extends DomainError {
  public constructor() {
    super('Device sealed secret publisher is not authorized.');
  }
}
