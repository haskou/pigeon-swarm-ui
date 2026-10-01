import type { Signature } from '@haskou/pigeon-swarm-crypto';

import type { DeviceCredential } from './value-objects/DeviceCredential';

export class DeviceAuthorizationEnrollmentProof {
  public constructor(
    private readonly credential: DeviceCredential,
    private readonly signature: Signature,
  ) {}

  public getCredential(): DeviceCredential {
    return this.credential;
  }

  public getSignature(): Signature {
    return this.signature;
  }
}
