import { assert } from '@haskou/value-objects';

import type { DeviceAuthorization } from '../DeviceAuthorization';
import type { DeviceAuthorizationTransition } from '../DeviceAuthorizationTransition';
import type { DeviceAuthorizationTransitionLog } from '../DeviceAuthorizationTransitionLog';
import type { DeviceCredential } from '../value-objects/DeviceCredential';
import type { DeviceAuthorizationReplay } from './DeviceAuthorizationReplay';
import type { LocalDeviceAuthorizationCheckpoint } from './LocalDeviceAuthorizationCheckpoint';

import { DeviceRemovedError } from '../DeviceRemovedError';
import { UnprovenDeviceAuthorizationError } from '../errors/UnprovenDeviceAuthorizationError';
import { DeviceAuthorizationPolicy } from './DeviceAuthorizationPolicy';

/**
 * Decides from a served transition log whether this device is still
 * authorized or was removed. Only positive signed evidence counts: the log
 * must replay in full from the genesis this device verified, and the
 * removal must lie above the local checkpoint. A node can withhold the log
 * and so delay a removal, but it cannot forge one.
 */
export class DeviceRemovalDomainService {
  private static replayOf(
    genesis: DeviceAuthorization,
    log: DeviceAuthorizationTransitionLog,
  ): DeviceAuthorizationReplay {
    try {
      assert(
        log.getIdentityId().isEqual(genesis.getIdentityId()),
        new UnprovenDeviceAuthorizationError(),
      );
      const replay = DeviceAuthorizationPolicy.replay(
        DeviceAuthorizationPolicy.replayRecoveryLineage(
          genesis,
          log.getRecoveries(),
          log.getConcurrentRecoveries(),
        ),
        log.getCandidates(),
      );

      assert(
        replay.accepted.length === log.getCandidates().length,
        new UnprovenDeviceAuthorizationError(),
      );

      return replay;
    } catch {
      throw new UnprovenDeviceAuthorizationError();
    }
  }

  /**
   * The signed transition that removed the reader above the local
   * checkpoint.
   */
  private static removalOf(
    log: DeviceAuthorizationTransitionLog,
    replay: DeviceAuthorizationReplay,
    reader: DeviceCredential,
    local: LocalDeviceAuthorizationCheckpoint,
  ): DeviceAuthorizationTransition | undefined {
    const recovery = log
      .getRecoveries()
      .find(
        (entry) =>
          entry.getEpoch().isEqual(local.epoch) &&
          !entry.getTargetCredential().isEqual(reader),
      );

    if (recovery) return recovery;

    const { states } = replay;
    const removed = states.findIndex(
      (state, index) =>
        index > 0 &&
        state.getRevision().isGreaterThan(local.revision) &&
        states[index - 1].isAuthorized(reader) &&
        !state.isAuthorized(reader),
    );

    if (removed < 0) return undefined;

    const groupRevision = states[removed - 1].getRevision();

    return log
      .getCandidates()
      .map(({ transition }) => transition)
      .find(
        (transition) =>
          transition.getPreviousRevision().isEqual(groupRevision) &&
          (transition.isRecovery() ||
            transition.getTargetCredential().isEqual(reader)),
      );
  }

  /**
   * Returns the replay of a log whose head still authorizes the reader.
   * Rejects with DeviceRemovedError on a verified removal, and with
   * UnprovenDeviceAuthorizationError when the log proves neither.
   */
  public static verifiedReplay(input: {
    genesis: DeviceAuthorization;
    local: LocalDeviceAuthorizationCheckpoint;
    log: DeviceAuthorizationTransitionLog;
    reader: DeviceCredential;
  }): DeviceAuthorizationReplay {
    const replay = this.replayOf(input.genesis, input.log);
    const removal = this.removalOf(
      input.log,
      replay,
      input.reader,
      input.local,
    );

    if (removal) {
      throw new DeviceRemovedError(
        removal.getIdentityId().valueOf(),
        removal.getOperationId().valueOf(),
      );
    }

    const head = replay.states[replay.states.length - 1];

    assert(
      head.isAuthorized(input.reader) &&
        head.getRevision().isGreaterOrEqualThan(input.local.revision),
      new UnprovenDeviceAuthorizationError(),
    );

    return replay;
  }

  /** The head of the verified replay; see verifiedReplay. */
  public static verify(input: {
    genesis: DeviceAuthorization;
    local: LocalDeviceAuthorizationCheckpoint;
    log: DeviceAuthorizationTransitionLog;
    reader: DeviceCredential;
  }): DeviceAuthorization {
    const { states } = this.verifiedReplay(input);

    return states[states.length - 1];
  }
}
