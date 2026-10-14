import type { DeviceAuthorizationCandidate } from './DeviceAuthorizationCandidate';
import type { DeviceAuthorizationTransitionLogPrimitives } from './DeviceAuthorizationTransitionLogPrimitives';

import { DeviceAuthorizationTransition } from './DeviceAuthorizationTransition';
import { IdentityId } from './value-objects/IdentityId';

/**
 * The signed device-authorization transitions a node served for one
 * identity: the recovery lineage behind the replay base, the recoveries that
 * lost its checkpoints, and the history in replay order. Nothing here is
 * trusted until the replay verifies it.
 */
export class DeviceAuthorizationTransitionLog {
  public static fromPrimitives(
    primitives: DeviceAuthorizationTransitionLogPrimitives,
  ): DeviceAuthorizationTransitionLog {
    return new DeviceAuthorizationTransitionLog(
      IdentityId.fromString(primitives.identityId),
      primitives.recoveries.map((entry) =>
        DeviceAuthorizationTransition.fromPrimitives(entry),
      ),
      primitives.concurrentRecoveries.map((entry) =>
        DeviceAuthorizationTransition.fromPrimitives(entry),
      ),
      primitives.transitions.map((entry) => ({
        encoding: JSON.stringify(entry),
        transition: DeviceAuthorizationTransition.fromPrimitives(entry),
      })),
    );
  }

  private constructor(
    private readonly identityId: IdentityId,
    private readonly recoveries: DeviceAuthorizationTransition[],
    private readonly concurrentRecoveries: DeviceAuthorizationTransition[],
    private readonly candidates: DeviceAuthorizationCandidate[],
  ) {}

  public getIdentityId(): IdentityId {
    return this.identityId;
  }

  public getRecoveries(): DeviceAuthorizationTransition[] {
    return [...this.recoveries];
  }

  public getConcurrentRecoveries(): DeviceAuthorizationTransition[] {
    return [...this.concurrentRecoveries];
  }

  public getCandidates(): DeviceAuthorizationCandidate[] {
    return [...this.candidates];
  }
}
