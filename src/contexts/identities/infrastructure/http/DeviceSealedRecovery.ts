import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { KeychainHead } from '../crypto/KeychainCipher';
import type { Session } from '../session/Session';
import type {
  DeviceSealedRecoveryStore,
  PendingDeviceSealedRecovery,
} from '../storage/DeviceSealedRecoveryStore';
import type { DeviceSealedRootRotation } from './DeviceSealedRootRotation';
import type { PigeonKeychainApi } from './PigeonKeychainApi';

import { sessionRootKey } from '../session/sessionRootKey';

/**
 * Completes device-sealed steps that failed after their change already took
 * effect. Each step is recorded before its change, with secrets sealed under
 * the master key, and cleared only when it succeeds. Unlock resumes whatever
 * is still recorded, so recovery needs no root to be open first.
 */
export class DeviceSealedRecovery {
  public constructor(
    private readonly deviceSealedRoot: DeviceSealedRootRotation,
    private readonly keychains: PigeonKeychainApi,
    private readonly store: DeviceSealedRecoveryStore,
  ) {}

  private forget(
    identityId: string,
    step: keyof PendingDeviceSealedRecovery,
  ): void {
    const pending = this.store.read(identityId);
    const kept: PendingDeviceSealedRecovery =
      step === 'keychainRewrap'
        ? { rootReseal: pending.rootReseal }
        : { keychainRewrap: pending.keychainRewrap };

    try {
      this.store.write(identityId, kept);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Could not clear a completed device-sealed recovery step');
    }
  }

  /**
   * Records the root that keeps the keychain readable, before a revoke moves
   * it. Throws when the record cannot be written, so the revoke does not run.
   */
  public rememberKeychainRewrap(session: Session): void {
    const identityId = session.identity.id;

    this.store.write(identityId, {
      ...this.store.read(identityId),
      keychainRewrap: session.masterKey
        .encrypt(sessionRootKey(session).toString())
        .toString(),
    });
  }

  /**
   * Rewraps the keychain head under the root minted by the revoke. A failure
   * keeps the record, so the next unlock retries it. Never throws.
   */
  public async rewrapAfterRevoke(
    rotated: Session,
    head: KeychainHead,
  ): Promise<void> {
    const identityId = rotated.identity.id;

    try {
      await this.keychains.rewrapHead(rotated, head);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Keychain rewrap after revoke failed; retrying on unlock');

      return;
    }

    this.forget(identityId, 'keychainRewrap');
  }

  /**
   * Rewraps a keychain head that a revoke left sealed under the previous root.
   * Waits while the session holds no root. Never throws.
   */
  public async resumeKeychainRewrap(rooted: Session): Promise<void> {
    const identityId = rooted.identity.id;
    const { keychainRewrap } = this.store.read(identityId);

    if (!keychainRewrap || !rooted.deviceSealedRootKey) return;

    try {
      const previousKey = SymmetricKey.fromBase64(
        rooted.masterKey
          .decrypt(new EncryptedPayload(keychainRewrap))
          .toString(),
      );

      await this.keychains.rewrapHeadSealedUnder(rooted, previousKey);
    } catch {
      // eslint-disable-next-line no-console
      console.debug(
        'Keychain rewrap on unlock failed; retrying on next unlock',
      );

      return;
    }

    this.forget(identityId, 'keychainRewrap');
  }

  /**
   * Reseals the root after a pairing authorization is applied. The root is
   * recorded first, so a failed reseal is retried on unlock. A record that
   * cannot be written does not stop the reseal, and a failed reseal in that
   * case is not retried. Never throws, so the caller still returns the
   * completion code.
   */
  public async resealAfterPairing(
    session: Session,
    root: SymmetricKey,
  ): Promise<void> {
    const identityId = session.identity.id;

    try {
      this.store.write(identityId, {
        ...this.store.read(identityId),
        rootReseal: {
          authorizationRevision: session.authorizationRevision.valueOf(),
          rootKey: session.masterKey.encrypt(root.toString()).toString(),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Could not record the pending root reseal; resealing now');
    }

    try {
      await this.deviceSealedRoot.reseal(session, root);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Root reseal after pairing failed; retrying on unlock');

      return;
    }

    this.forget(identityId, 'rootReseal');
  }

  /**
   * Reseals the recorded root at the synchronized revision. A record for any
   * other revision is dropped, because its root no longer matches the
   * authorization. Never throws.
   */
  public async resumeRootReseal(synchronized: Session): Promise<void> {
    const identityId = synchronized.identity.id;
    const { rootReseal } = this.store.read(identityId);

    if (!rootReseal) return;

    if (
      rootReseal.authorizationRevision !==
      synchronized.authorizationRevision.valueOf()
    ) {
      this.forget(identityId, 'rootReseal');

      return;
    }

    try {
      const root = SymmetricKey.fromBase64(
        synchronized.masterKey
          .decrypt(new EncryptedPayload(rootReseal.rootKey))
          .toString(),
      );

      await this.deviceSealedRoot.reseal(synchronized, root);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Root reseal on unlock failed; retrying on next unlock');

      return;
    }

    this.forget(identityId, 'rootReseal');
  }

  /**
   * Mints a fresh root when this device's own entry is behind the head, as
   * after another device forgot itself: that device can no longer publish, so
   * the next remaining device to unlock does. The keychain head is read under
   * the lagging root and moved to the fresh one, recorded first like a revoke.
   * Returns the session unchanged when nothing lags or nothing was minted.
   * Never throws.
   */
  public async rotateLaggingRoot(synchronized: Session): Promise<Session> {
    let rotated: Session;
    let head: KeychainHead | undefined;

    try {
      const lagging = await this.deviceSealedRoot.laggingRoot(synchronized);

      if (!lagging) return synchronized;

      const previous = { ...synchronized, deviceSealedRootKey: lagging };

      head = await this.keychains.readHead(previous);

      if (head) this.rememberKeychainRewrap(previous);

      rotated = await this.deviceSealedRoot.rotate(synchronized);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Lagging root rotation failed; retrying on next unlock');

      return synchronized;
    }

    if (head) await this.rewrapAfterRevoke(rotated, head);

    return rotated;
  }
}
