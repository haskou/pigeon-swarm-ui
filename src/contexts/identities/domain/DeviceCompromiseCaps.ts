import type { DeviceAuthorizationCompromisedCredential } from './DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationTransition } from './DeviceAuthorizationTransition';
import type { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from './value-objects/DeviceCredential';

/** The compromise caps a recovery lineage carries. */
export class DeviceCompromiseCaps {
  public static none(): DeviceCompromiseCaps {
    return new DeviceCompromiseCaps([]);
  }

  public static carriedBy(
    recovery: DeviceAuthorizationTransition,
  ): DeviceCompromiseCaps {
    return new DeviceCompromiseCaps(recovery.getCompromisedCredentials());
  }

  private constructor(
    private readonly caps: readonly DeviceAuthorizationCompromisedCredential[],
  ) {}

  public isCompromisedAt(
    credential: DeviceCredential,
    revision: DeviceAuthorizationRevision,
  ): boolean {
    const cap = this.caps.find((entry) => entry.credential.isEqual(credential));

    return (
      cap !== undefined && revision.isGreaterOrEqualThan(cap.compromisedSince)
    );
  }

  /** A later recovery may tighten or add caps, never drop or loosen one. */
  public isNotLoosenedBy(next: DeviceCompromiseCaps): boolean {
    return this.caps.every((cap) =>
      next.isCompromisedAt(cap.credential, cap.compromisedSince),
    );
  }
}
