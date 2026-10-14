import { assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCandidate } from '../DeviceAuthorizationCandidate';
import type { DeviceAuthorizationTransition } from '../DeviceAuthorizationTransition';
import type { AdmittedDeviceAuthorizationCandidate } from './AdmittedDeviceAuthorizationCandidate';
import type { DeviceAuthorizationReplay } from './DeviceAuthorizationReplay';
import type { DeviceRecoveryLineageState } from './DeviceRecoveryLineageState';

import { DeviceAuthorization } from '../DeviceAuthorization';
import { DeviceCompromiseCaps } from '../DeviceCompromiseCaps';
import { InvalidDeviceAuthorizationTransitionError } from '../errors/InvalidDeviceAuthorizationTransitionError';

/**
 * The node replay rules, ported so this device verifies a served log on its
 * own: every transition must carry valid signatures and apply in causal
 * order to the state this device derives from its signed genesis. Any
 * deviation from the node policy changes which device a log removes, so the
 * two MUST stay in step and both pass the shared vectors.
 */
export class DeviceAuthorizationPolicy {
  private static verifyRecoverySignatures(
    authorization: DeviceAuthorization,
    transition: DeviceAuthorizationTransition,
  ): void {
    assert(
      transition.hasTargetProof() &&
        transition.isSignedBy(
          authorization.getRecoveryAuthority().getPublicKey(),
        ),
      new InvalidDeviceAuthorizationTransitionError(),
    );
  }

  private static verifyDeviceAuthor(
    authorization: DeviceAuthorization,
    transition: DeviceAuthorizationTransition,
  ): void {
    const author = transition.getAuthorCredential();

    assert(
      authorization.isAuthorized(author) &&
        transition.isSignedBy(author.getPublicKey()),
      new InvalidDeviceAuthorizationTransitionError(),
    );
  }

  private static apply(
    authorization: DeviceAuthorization,
    transition: DeviceAuthorizationTransition,
  ): DeviceAuthorization {
    assert(
      authorization.getIdentityId().isEqual(transition.getIdentityId()) &&
        authorization.getEpoch().isEqual(transition.getEpoch()) &&
        authorization.getRevision().isEqual(transition.getPreviousRevision()) &&
        transition
          .getResultRevision()
          .isEqual(authorization.getRevision().next()),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    if (transition.isEnrollment()) {
      this.verifyDeviceAuthor(authorization, transition);
      assert(
        transition.hasTargetProof(),
        new InvalidDeviceAuthorizationTransitionError(),
      );

      return authorization.enroll(transition.getTargetCredential());
    }

    if (transition.isRevocation()) {
      this.verifyDeviceAuthor(authorization, transition);

      return authorization.revoke(transition.getTargetCredential());
    }

    this.verifyRecoverySignatures(authorization, transition);

    return authorization.recover(
      transition.getTargetCredential(),
      transition.getResultEpoch(),
    );
  }

  /** A rejected transition is inapplicable here, not a failed replay. */
  private static tryApply(
    authorization: DeviceAuthorization,
    transition: DeviceAuthorizationTransition,
  ): DeviceAuthorization | undefined {
    try {
      return this.apply(authorization, transition);
    } catch {
      return undefined;
    }
  }

  private static applyRecoveryCheckpoint(
    authorization: DeviceAuthorization,
    transition: DeviceAuthorizationTransition,
  ): DeviceAuthorization {
    assert(
      transition.isRecovery() &&
        authorization.getIdentityId().isEqual(transition.getIdentityId()) &&
        authorization.getEpoch().isEqual(transition.getEpoch()) &&
        transition
          .getPreviousRevision()
          .isGreaterOrEqualThan(authorization.getRevision()),
      new InvalidDeviceAuthorizationTransitionError(),
    );
    this.verifyRecoverySignatures(authorization, transition);

    return authorization.recoverAt(
      transition.getResultRevision(),
      transition.getTargetCredential(),
      transition.getResultEpoch(),
    );
  }

  /**
   * One recovery of a lineage: it must apply to the previous state and keep
   * every cap that state carried at least as tight.
   */
  private static recoverLineage(
    previous: DeviceRecoveryLineageState,
    recovery: DeviceAuthorizationTransition,
  ): DeviceRecoveryLineageState {
    const authorization = this.applyRecoveryCheckpoint(
      previous.authorization,
      recovery,
    );
    const carried = DeviceCompromiseCaps.carriedBy(recovery);

    assert(
      previous.compromiseCaps.isNotLoosenedBy(carried),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return { authorization, compromiseCaps: carried };
  }

  /**
   * Candidates at one revision replay by operation id, then by the encoding
   * the node served: the protocol tie-break every replica derives alike.
   */
  private static replayOrder(
    left: DeviceAuthorizationCandidate,
    right: DeviceAuthorizationCandidate,
  ): number {
    return (
      left.transition
        .getOperationId()
        .compareTo(right.transition.getOperationId()) ||
      left.encoding.localeCompare(right.encoding)
    );
  }

  private static admittedAt(
    authorization: DeviceAuthorization,
    candidates: DeviceAuthorizationCandidate[],
  ): AdmittedDeviceAuthorizationCandidate[] {
    return candidates
      .filter(({ transition }) =>
        transition.getPreviousRevision().isEqual(authorization.getRevision()),
      )
      .sort((left, right) => this.replayOrder(left, right))
      .flatMap((candidate) => {
        const applied = this.tryApply(authorization, candidate.transition);

        return applied === undefined
          ? []
          : [{ authorization: applied, candidate }];
      });
  }

  /** Transitions with one effect replay once, as the lowest encoding. */
  private static compactEquivalent(
    admitted: AdmittedDeviceAuthorizationCandidate[],
  ): AdmittedDeviceAuthorizationCandidate[] {
    const compacted: AdmittedDeviceAuthorizationCandidate[] = [];

    for (const entry of admitted) {
      const index = compacted.findIndex(({ candidate }) =>
        candidate.transition.hasSameEffectAs(entry.candidate.transition),
      );

      if (index === -1) {
        compacted.push(entry);
      } else if (
        entry.candidate.encoding < compacted[index].candidate.encoding
      ) {
        compacted[index] = entry;
      }
    }

    return compacted;
  }

  /** A recovery first, then concurrent revocations, else enrollments. */
  private static checkpointOf(
    authorization: DeviceAuthorization,
    admitted: AdmittedDeviceAuthorizationCandidate[],
  ): DeviceAuthorization {
    const recovery = admitted.find(({ candidate }) =>
      candidate.transition.isRecovery(),
    );

    if (recovery) return recovery.authorization;

    const revocations = admitted.filter(({ candidate }) =>
      candidate.transition.isRevocation(),
    );

    if (revocations.length > 0) {
      return authorization.revokeConcurrently(
        revocations.map(({ candidate }) =>
          candidate.transition.getTargetCredential(),
        ),
      );
    }

    return authorization.enrollConcurrently(
      admitted.map(({ candidate }) =>
        candidate.transition.getTargetCredential(),
      ),
    );
  }

  /**
   * The state a lost recovery recovered from: the one replayed state, on the
   * lineage or a lost recovery replayed before it, in the epoch the lost
   * recovery is signed in. Its own epoch must still be new, so no recovery
   * replays twice.
   */
  private static lostRecoveryBase(
    states: DeviceRecoveryLineageState[],
    lost: DeviceAuthorizationTransition,
  ): DeviceRecoveryLineageState {
    const [base, ...ambiguous] = states.filter(({ authorization }) =>
      authorization.getEpoch().isEqual(lost.getEpoch()),
    );

    assert(
      base !== undefined &&
        ambiguous.length === 0 &&
        !states.some(({ authorization }) =>
          authorization.getEpoch().isEqual(lost.getResultEpoch()),
        ),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return base;
  }

  /**
   * The replay base of a recovery lineage. Every recovery must apply and
   * never loosen a cap an earlier one carried. A concurrent recovery lost
   * the checkpoint at or below the last recovery's revision, from any earlier
   * state: it must apply from the one replayed state in its epoch, lowest
   * revision first, so a lost recovery chained from another one replays too.
   */
  public static replayRecoveryLineage(
    genesis: DeviceAuthorization,
    recoveries: DeviceAuthorizationTransition[],
    concurrent: DeviceAuthorizationTransition[],
  ): DeviceAuthorization {
    let head: DeviceRecoveryLineageState = {
      authorization: genesis,
      compromiseCaps: DeviceCompromiseCaps.none(),
    };
    const states = [head];

    for (const recovery of recoveries) {
      head = this.recoverLineage(head, recovery);
      states.push(head);
    }

    const last =
      recoveries.length > 0 ? recoveries[recoveries.length - 1] : undefined;
    const lowestRevisionFirst = [...concurrent].sort(
      (left, right) =>
        left.getResultRevision().valueOf() -
        right.getResultRevision().valueOf(),
    );

    for (const lost of lowestRevisionFirst) {
      assert(
        last !== undefined &&
          !lost.getResultRevision().isGreaterThan(last.getResultRevision()),
        new InvalidDeviceAuthorizationTransitionError(),
      );
      states.push(
        this.recoverLineage(this.lostRecoveryBase(states, lost), lost),
      );
    }

    return head.authorization;
  }

  /**
   * Replays candidates from a base. At each revision the admitted candidates
   * are compacted by effect and one checkpoint is taken. The states run
   * from the base to the head.
   */
  public static replay(
    base: DeviceAuthorization,
    candidates: DeviceAuthorizationCandidate[],
  ): DeviceAuthorizationReplay {
    const accepted: DeviceAuthorizationCandidate[] = [];
    const states = [base];
    let authorization = base;
    let admitted = this.admittedAt(authorization, candidates);

    while (admitted.length > 0) {
      const compacted = this.compactEquivalent(admitted);
      const checkpoint = this.checkpointOf(authorization, compacted);

      assert(
        checkpoint.getRevision().isGreaterThan(authorization.getRevision()),
        new InvalidDeviceAuthorizationTransitionError(),
      );

      accepted.push(...compacted.map(({ candidate }) => candidate));
      states.push(checkpoint);
      authorization = checkpoint;
      admitted = this.admittedAt(authorization, candidates);
    }

    return { accepted, states };
  }
}
