import { assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCompromisedCredential as CompromisedCredential } from './DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import type { IdentityId } from './value-objects/IdentityId';

import { DeviceAuthorizationIdentityMismatchError } from './errors/DeviceAuthorizationIdentityMismatchError';

export class DeviceAuthorizationCheckpoint {
  /** A checkpoint is only accepted for the identity that asked for it. */
  public static forIdentity(
    expectedIdentityId: IdentityId,
    state: {
      compromisedCredentials: CompromisedCredential[];
      epoch: DeviceAuthorizationEpoch;
      identityId: IdentityId;
      revision: DeviceAuthorizationRevision;
    },
  ): DeviceAuthorizationCheckpoint {
    assert(
      state.identityId.isEqual(expectedIdentityId),
      new DeviceAuthorizationIdentityMismatchError(),
    );

    return new DeviceAuthorizationCheckpoint(
      state.epoch,
      state.identityId,
      state.revision,
      state.compromisedCredentials,
    );
  }

  private constructor(
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly identityId: IdentityId,
    private readonly revision: DeviceAuthorizationRevision,
    private readonly compromisedCredentials: CompromisedCredential[],
  ) {}

  public getCompromisedCredentials(): CompromisedCredential[] {
    return [...this.compromisedCredentials];
  }

  public getEpoch(): DeviceAuthorizationEpoch {
    return this.epoch;
  }

  public getIdentityId(): IdentityId {
    return this.identityId;
  }

  public getRevision(): DeviceAuthorizationRevision {
    return this.revision;
  }
}
