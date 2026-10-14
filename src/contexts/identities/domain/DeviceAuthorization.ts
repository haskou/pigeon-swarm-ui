import { assert } from '@haskou/value-objects';

import type { RecoveryAuthority } from './value-objects/RecoveryAuthority';

import { InvalidDeviceAuthorizationTransitionError } from './errors/InvalidDeviceAuthorizationTransitionError';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { IdentityId } from './value-objects/IdentityId';

const MAX_DEVICE_CREDENTIALS = 128;

/**
 * The device credentials an identity authorizes at one epoch and revision,
 * replayed on this device from signed transitions. It mirrors the node
 * aggregate so both derive the same state from the same history.
 */
export class DeviceAuthorization {
  /** The state every identity starts from, as identity version 1 signs it. */
  public static genesis(
    identityId: IdentityId,
    credential: DeviceCredential,
    recoveryAuthority: RecoveryAuthority,
  ): DeviceAuthorization {
    return new DeviceAuthorization(
      identityId,
      recoveryAuthority,
      DeviceAuthorizationRevision.initial(),
      DeviceAuthorizationEpoch.genesis(),
      [credential],
    );
  }

  private constructor(
    private readonly identityId: IdentityId,
    private readonly recoveryAuthority: RecoveryAuthority,
    private readonly revision: DeviceAuthorizationRevision,
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly credentials: readonly DeviceCredential[],
  ) {
    assert(
      credentials.length <= MAX_DEVICE_CREDENTIALS &&
        recoveryAuthority.isIndependentFrom([
          DeviceCredential.fromPublicKey(identityId.getPublicKey()),
          ...credentials,
        ]),
      new InvalidDeviceAuthorizationTransitionError(),
    );
  }

  private next(
    credentials: readonly DeviceCredential[],
    epoch: DeviceAuthorizationEpoch = this.epoch,
    revision: DeviceAuthorizationRevision = this.revision.next(),
  ): DeviceAuthorization {
    return new DeviceAuthorization(
      this.identityId,
      this.recoveryAuthority,
      revision,
      epoch,
      credentials,
    );
  }

  public getIdentityId(): IdentityId {
    return this.identityId;
  }

  public getRecoveryAuthority(): RecoveryAuthority {
    return this.recoveryAuthority;
  }

  public getRevision(): DeviceAuthorizationRevision {
    return this.revision;
  }

  public getEpoch(): DeviceAuthorizationEpoch {
    return this.epoch;
  }

  public isAuthorized(credential: DeviceCredential): boolean {
    return this.credentials.some((authorized) =>
      authorized.isEqual(credential),
    );
  }

  public enroll(credential: DeviceCredential): DeviceAuthorization {
    assert(
      !this.isAuthorized(credential),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return this.next([...this.credentials, credential]);
  }

  /**
   * Concurrent enrollments add new credentials in locale order up to the
   * cap.
   */
  public enrollConcurrently(
    credentials: DeviceCredential[],
  ): DeviceAuthorization {
    const added = credentials
      .filter(
        (credential, index) =>
          !this.isAuthorized(credential) &&
          credentials.findIndex((other) => other.isEqual(credential)) === index,
      )
      .sort((left, right) => left.compareTo(right))
      .slice(0, MAX_DEVICE_CREDENTIALS - this.credentials.length);

    assert(added.length > 0, new InvalidDeviceAuthorizationTransitionError());

    return this.next([...this.credentials, ...added]);
  }

  public revoke(credential: DeviceCredential): DeviceAuthorization {
    assert(
      this.isAuthorized(credential) && this.credentials.length > 1,
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return this.next(
      this.credentials.filter((authorized) => !authorized.isEqual(credential)),
    );
  }

  /**
   * Concurrent revocations drop every revoked credential. When none would
   * remain, the first credential in locale order survives.
   */
  public revokeConcurrently(
    credentials: DeviceCredential[],
  ): DeviceAuthorization {
    const revoked = credentials.filter((credential) =>
      this.isAuthorized(credential),
    );

    assert(revoked.length > 0, new InvalidDeviceAuthorizationTransitionError());

    const remaining = this.credentials.filter((authorized) =>
      revoked.every((credential) => !authorized.isEqual(credential)),
    );

    return this.next(
      remaining.length > 0
        ? remaining
        : [
            [...this.credentials].sort((left, right) =>
              left.compareTo(right),
            )[0],
          ],
    );
  }

  public recover(
    credential: DeviceCredential,
    epoch: DeviceAuthorizationEpoch,
  ): DeviceAuthorization {
    return this.next([credential], epoch);
  }

  /** A recovery checkpoint jumps to its revision, which must be ahead. */
  public recoverAt(
    revision: DeviceAuthorizationRevision,
    credential: DeviceCredential,
    epoch: DeviceAuthorizationEpoch,
  ): DeviceAuthorization {
    assert(
      revision.isGreaterThan(this.revision),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return this.next([credential], epoch, revision);
  }
}
