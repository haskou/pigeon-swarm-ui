import { DomainError } from '@haskou/value-objects';

/**
 * The signed transitions authorized the device that published a
 * device-sealed secret at the revision the secret names, but a later
 * transition revoked it. A revoke signals that the key may be in other hands,
 * so the secret is not trusted however validly that device signed it.
 */
export class RevokedDeviceSealedSecretPublisherError extends DomainError {
  public constructor() {
    super(
      'Device sealed secret publisher was revoked after the entry revision.',
    );
  }
}
