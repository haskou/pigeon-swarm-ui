import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../identities/domain/DeviceAuthorizationTransitionLogPrimitives';

import { DeviceAuthorization } from '../../../identities/domain/DeviceAuthorization';
import { DeviceAuthorizationTransitionLog } from '../../../identities/domain/DeviceAuthorizationTransitionLog';
import { DeviceAuthorizationPolicy } from '../../../identities/domain/services/DeviceAuthorizationPolicy';
import { CallSignalRefusedError } from './CallSignalRefusedError';

const MINIMUM_REPLICAS = 2;

const stateKey = (state: DeviceAuthorization): string =>
  `${state.getEpoch().valueOf()}|${state
    .getCredentials()
    .map((credential) => credential.valueOf())
    .sort()
    .join(',')}`;

/**
 * The sender's authorization head, proven by signed transitions. Every
 * replica's log must replay in full from the genesis the verifier trusts,
 * at least two distinct replicas must have answered, and replicas must agree
 * on every revision they share. A node can serve a shorter log, never a
 * longer forged one, so the highest verified head is the best proven state.
 */
export class SenderAuthorizationChain {
  private static replayOf(
    genesis: DeviceAuthorization,
    primitives: DeviceAuthorizationTransitionLogPrimitives,
  ): DeviceAuthorization[] {
    try {
      const log = DeviceAuthorizationTransitionLog.fromPrimitives(primitives);

      if (!log.getIdentityId().isEqual(genesis.getIdentityId())) {
        throw new Error('foreign log');
      }

      const replay = DeviceAuthorizationPolicy.replay(
        DeviceAuthorizationPolicy.replayRecoveryLineage(
          genesis,
          log.getRecoveries(),
          log.getConcurrentRecoveries(),
        ),
        log.getCandidates(),
      );

      if (replay.accepted.length !== log.getCandidates().length) {
        throw new Error('unreplayable log');
      }

      return replay.states;
    } catch {
      throw new CallSignalRefusedError('chain-unverified');
    }
  }

  public static verify(
    genesis: DeviceAuthorization,
    logs: DeviceAuthorizationTransitionLogPrimitives[],
  ): DeviceAuthorization {
    if (logs.length < MINIMUM_REPLICAS) {
      throw new CallSignalRefusedError('chain-unverified');
    }

    const byRevision = new Map<number, string>();
    let head = genesis;

    for (const primitives of logs) {
      const states = SenderAuthorizationChain.replayOf(genesis, primitives);

      for (const state of states) {
        const revision = state.getRevision().valueOf();
        const key = stateKey(state);

        if ((byRevision.get(revision) ?? key) !== key) {
          throw new CallSignalRefusedError('chain-unverified');
        }

        byRevision.set(revision, key);
      }

      const last = states[states.length - 1];

      if (last.getRevision().valueOf() > head.getRevision().valueOf()) {
        head = last;
      }
    }

    return head;
  }
}
