import { assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCheckpointResource } from './DeviceAuthorizationCheckpointResource';

import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { IdentityId } from './value-objects/IdentityId';

export class DeviceAuthorizationCheckpoint {
  public static fromResource(
    resource: DeviceAuthorizationCheckpointResource,
    expectedIdentityId: IdentityId,
  ): DeviceAuthorizationCheckpoint {
    const identityId = IdentityId.fromString(resource.identityId);

    assert(
      identityId.isEqual(expectedIdentityId),
      new Error('Device authorization identity does not match.'),
    );

    return new DeviceAuthorizationCheckpoint(
      DeviceAuthorizationEpoch.fromString(resource.epoch),
      identityId,
      DeviceAuthorizationRevision.fromNumber(resource.revision),
    );
  }

  private constructor(
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly identityId: IdentityId,
    private readonly revision: DeviceAuthorizationRevision,
  ) {}

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
