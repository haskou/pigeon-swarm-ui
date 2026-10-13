import type { DeviceAuthorizationCheckpointResource } from './resources/DeviceAuthorizationCheckpointResource';

import { DeviceAuthorizationCheckpoint } from '../../domain/DeviceAuthorizationCheckpoint';
import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import { IdentityId } from '../../domain/value-objects/IdentityId';

export class DeviceAuthorizationCheckpointMapper {
  public static fromResource(
    resource: DeviceAuthorizationCheckpointResource,
    expectedIdentityId: IdentityId,
  ): DeviceAuthorizationCheckpoint {
    return DeviceAuthorizationCheckpoint.forIdentity(expectedIdentityId, {
      compromisedCredentials: (resource.compromisedCredentials ?? []).map(
        (entry) => ({
          compromisedSince: DeviceAuthorizationRevision.fromNumber(
            entry.compromisedSince,
          ),
          credential: DeviceCredential.fromString(entry.credential),
        }),
      ),
      epoch: DeviceAuthorizationEpoch.fromString(resource.epoch),
      identityId: IdentityId.fromString(resource.identityId),
      revision: DeviceAuthorizationRevision.fromNumber(resource.revision),
    });
  }
}
