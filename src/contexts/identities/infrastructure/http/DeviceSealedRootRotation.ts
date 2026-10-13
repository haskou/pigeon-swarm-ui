import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../session/Session';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from './PigeonDeviceSealedSecretApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

/**
 * Publishes and opens the device-sealed root of one identity. A generation
 * carries one root, sealed to every device at the head. Enrolment reseals the
 * same root; a revoke mints a fresh one. A device opens its own entry while it
 * matches its authorization revision. A stale session re-syncs once and never
 * mints a root itself: an entry still behind the head is only read as the
 * lagging root that a fresh one replaces. A device with no entry mints only
 * after the identity keychain head reads: a head sealed under a root this
 * device cannot open blocks the mint, so that keychain is not stranded.
 */
export class DeviceSealedRootRotation {
  public constructor(
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly sealedSecrets: PigeonDeviceSealedSecretApi,
    private readonly keychains: PigeonKeychainApi,
    private readonly clock: () => number = Date.now,
  ) {}

  private async publishWithRetry(
    session: Session,
    root: SymmetricKey,
  ): Promise<Session> {
    try {
      return await this.publish(session, root);
    } catch (error: unknown) {
      if (!(error instanceof HttpJsonError) || error.status !== 409) {
        throw error;
      }

      return await this.publish(
        await this.deviceAuthorization.synchronize(session),
        root,
      );
    }
  }

  private async publish(
    session: Session,
    root: SymmetricKey,
  ): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);
    const recipients = await this.deviceAuthorization.findDevices(session);

    await this.sealedSecrets.publish(session, {
      generation: Math.max(own?.generation ?? 0, this.clock()) + 1,
      payload: encodeBase64Url(root.getBuffer()),
      recipients,
    });

    return { ...session, deviceSealedRootKey: root };
  }

  /**
   * Publishes a new generation with a fresh root and returns the session
   * holding it. A conflicting publish refetches the head once and publishes
   * again.
   */
  public async rotate(session: Session): Promise<Session> {
    return await this.publishWithRetry(session, SymmetricKey.generate());
  }

  /**
   * Publishes an existing root at a new generation, so enrolment keeps the
   * keychain readable under the same root.
   */
  public async reseal(session: Session, root: SymmetricKey): Promise<void> {
    await this.publishWithRetry(session, root);
  }

  /**
   * Returns the root of this device's own entry when that entry is behind the
   * session revision, or `null` when it is current or missing. A device that
   * forgot itself may still hold this root, so it only opens the keychain head
   * before a fresh root replaces it, and is never resealed.
   */
  public async laggingRoot(session: Session): Promise<SymmetricKey | null> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (
      !own ||
      own.authorizationRevision >= session.authorizationRevision.valueOf()
    ) {
      return null;
    }

    return SymmetricKey.fromBuffer(decodeBase64Url(own.payload));
  }

  /**
   * Returns the session holding the root of the current generation. Publishes
   * a new generation only when this device has no entry at all and the
   * keychain head is readable.
   */
  public async current(session: Session): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (!own) {
      await this.keychains.readHead(session);

      return await this.rotate(session);
    }

    if (own.authorizationRevision === session.authorizationRevision.valueOf()) {
      return {
        ...session,
        deviceSealedRootKey: SymmetricKey.fromBuffer(
          decodeBase64Url(own.payload),
        ),
      };
    }

    const synced = await this.deviceAuthorization.synchronize(session);
    const fresh = await this.sealedSecrets.fetchOwn(synced);

    if (
      fresh?.authorizationRevision !== synced.authorizationRevision.valueOf()
    ) {
      return synced;
    }

    return {
      ...synced,
      deviceSealedRootKey: SymmetricKey.fromBuffer(
        decodeBase64Url(fresh.payload),
      ),
    };
  }

  /** Generation of this device's sealed root entry; null without one. */
  public async generation(session: Session): Promise<number | null> {
    return (await this.sealedSecrets.fetchOwn(session))?.generation ?? null;
  }
}
