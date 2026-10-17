import { assert } from '@haskou/value-objects';

import type { DeviceAuthorization } from '../DeviceAuthorization';
import type { DeviceAuthorizationRevision } from '../value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../value-objects/DeviceCredential';
import type { DeviceAuthorizationReplay } from './DeviceAuthorizationReplay';

import { RevokedDeviceSealedSecretPublisherError } from '../errors/RevokedDeviceSealedSecretPublisherError';
import { UnauthorizedDeviceSealedSecretPublisherError } from '../errors/UnauthorizedDeviceSealedSecretPublisherError';

/**
 * Decides from a verified replay whether a device could publish a
 * device-sealed secret at the revision the secret names. A publish needs a
 * device the state at that revision authorizes and every later state still
 * authorizes: a key revoked afterwards may be in other hands, and could sign
 * a secret naming any revision it once held. A hand-over rides in the
 * publisher's own retirement, so it needs a device the state before that
 * revision authorized and a self-revocation of that device that the replay
 * accepted into it. A revision the replay never reached authorizes no one.
 */
export class DeviceSealedSecretPublisherDomainService {
  private static retiredInto(
    replay: DeviceAuthorizationReplay,
    before: DeviceAuthorization,
    publisher: DeviceCredential,
    revision: DeviceAuthorizationRevision,
  ): boolean {
    return (
      before.isAuthorized(publisher) &&
      replay.accepted.some(
        ({ transition }) =>
          transition.isRevocation() &&
          transition.getPreviousRevision().isEqual(before.getRevision()) &&
          transition.getResultRevision().isEqual(revision) &&
          transition.getAuthorCredential().isEqual(publisher) &&
          transition.getTargetCredential().isEqual(publisher),
      )
    );
  }

  public static verify(input: {
    publisher: DeviceCredential;
    replay: DeviceAuthorizationReplay;
    revision: DeviceAuthorizationRevision;
  }): void {
    const { publisher, replay, revision } = input;
    const index = replay.states.findIndex((state) =>
      state.getRevision().isEqual(revision),
    );
    const published =
      index >= 0 && replay.states[index].isAuthorized(publisher);

    if (published) {
      assert(
        replay.states
          .slice(index + 1)
          .every((state) => state.isAuthorized(publisher)),
        new RevokedDeviceSealedSecretPublisherError(),
      );

      return;
    }

    assert(
      index > 0 &&
        this.retiredInto(replay, replay.states[index - 1], publisher, revision),
      new UnauthorizedDeviceSealedSecretPublisherError(),
    );
  }
}
