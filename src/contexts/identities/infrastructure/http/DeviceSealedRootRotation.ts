import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { DeviceSealedRoots } from '../crypto/DeviceSealedRoots';
import type { OpenedDeviceSealedSecret } from '../crypto/OpenedDeviceSealedSecret';
import type { Session } from '../session/Session';
import type { DeviceSealedRootHandOver } from './DeviceSealedRootHandOver';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from './PigeonDeviceSealedSecretApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceSealedRootGeneration } from '../../domain/value-objects/DeviceSealedRootGeneration';
import { DeviceSealedRootPayload } from '../crypto/DeviceSealedRootPayload';

/**
 * Publishes and opens the device-sealed root of one identity. A generation
 * carries one root, sealed to every device at the head. Enrolment reseals the
 * same root; a revoke mints a fresh one and carries the root it replaces, so
 * the devices left move their local state off it. A device opens its own
 * entry while it matches its authorization revision. A stale session re-syncs
 * once and never mints a root itself: an entry still behind the head is only
 * read as the lagging root that a fresh one replaces. A device with no entry
 * mints only after the identity keychain head reads: a head sealed under a
 * root this device cannot open blocks the mint, so that keychain is not
 * stranded. The one exception is a device a recovery kit just authorized as
 * the only device: no one holds that root any more, so it replaces the head.
 * A device that forgets itself hands a fresh root, with the root it replaces,
 * to the devices that remain, inside its own retirement. No entry is opened,
 * nor its generation trusted, until the signed transitions authorize its
 * publisher at the entry revision; an entry they do not, or cannot, authorize
 * fails the call and leaves every local row as it was.
 */
export class DeviceSealedRootRotation {
  public constructor(
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly sealedSecrets: PigeonDeviceSealedSecretApi,
    private readonly keychains: PigeonKeychainApi,
    private readonly clock: () => number = Date.now,
  ) {}

  private nextGeneration(stored: number | undefined): number {
    return Math.max(stored ?? 0, this.clock()) + 1;
  }

  /**
   * Returns the entry once the signed transitions authorize its publisher at
   * the entry revision, so a signature by a key the node minted opens
   * nothing. Rejects otherwise, including when the transitions are not served.
   */
  private async verified(
    session: Session,
    entry: OpenedDeviceSealedSecret,
  ): Promise<OpenedDeviceSealedSecret> {
    await this.deviceAuthorization.verifyPublisher(
      session,
      entry.publisherCredential,
      DeviceAuthorizationRevision.fromNumber(entry.authorizationRevision),
    );

    return entry;
  }

  /** This device's own entry with a verified publisher; null without one. */
  private async ownEntry(
    session: Session,
  ): Promise<OpenedDeviceSealedSecret | null> {
    const own = await this.sealedSecrets.fetchOwn(session);

    return own ? await this.verified(session, own) : null;
  }

  private async publishWithRetry(
    session: Session,
    roots: DeviceSealedRoots,
    verifiedRecipients?: readonly DeviceCredential[],
  ): Promise<Session> {
    try {
      return await this.publish(session, roots, verifiedRecipients);
    } catch (error: unknown) {
      if (!(error instanceof HttpJsonError) || error.status !== 409) {
        throw error;
      }

      return await this.publish(
        await this.deviceAuthorization.synchronize(session),
        roots,
        verifiedRecipients,
      );
    }
  }

  /**
   * Seals the roots to the verified recipients when given, otherwise to the
   * devices the node lists at the head, and returns the session holding the
   * root at the generation it was published at.
   */
  private async publish(
    session: Session,
    roots: DeviceSealedRoots,
    verifiedRecipients?: readonly DeviceCredential[],
  ): Promise<Session> {
    const own = await this.ownEntry(session);
    const recipients = verifiedRecipients
      ? [...verifiedRecipients]
      : await this.deviceAuthorization.findDevices(session);
    const generation = this.nextGeneration(own?.generation);

    await this.sealedSecrets.publish(session, {
      generation,
      payload: DeviceSealedRootPayload.encode(roots),
      recipients,
    });

    return {
      ...session,
      deviceSealedRootGeneration:
        DeviceSealedRootGeneration.fromNumber(generation),
      deviceSealedRootKey: roots.root,
    };
  }

  /**
   * Publishes a new generation with a fresh root and returns the session
   * holding it, with the root it replaces kept as the previous root. The
   * replaced root rides sealed to the devices at the session's revision, which
   * all held it; a revoked device is no longer among them. A conflicting
   * publish refetches the head once and publishes again.
   */
  public async rotate(session: Session): Promise<Session> {
    const rotated = await this.publishWithRetry(session, {
      previous: session.deviceSealedRootKey,
      root: SymmetricKey.generate(),
    });

    return {
      ...rotated,
      previousDeviceSealedRootKey: session.deviceSealedRootKey,
    };
  }

  /**
   * Publishes an existing root at a new generation, so enrolment keeps the
   * keychain readable under the same root. No previous root rides along: the
   * enrolled device never held it.
   */
  public async reseal(session: Session, root: SymmetricKey): Promise<void> {
    await this.publishWithRetry(session, { root });
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
      session.authorizationRevision.isLessOrEqualThan(own.authorizationRevision)
    ) {
      return null;
    }

    return DeviceSealedRootPayload.decode(
      (await this.verified(session, own)).payload,
    ).root;
  }

  /**
   * Returns the session holding the root of the current generation, with
   * that generation, and the root a hand-over replaced. Publishes a new
   * generation only when this device has no entry at all and the keychain
   * head is readable.
   */
  public async current(session: Session): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (!own) {
      await this.keychains.readHead(session);

      return await this.rotate(session);
    }

    let opening = { entry: own, session };

    if (!session.authorizationRevision.hasValue(own.authorizationRevision)) {
      const synced = await this.deviceAuthorization.synchronize(session);
      const fresh = await this.sealedSecrets.fetchOwn(synced);

      if (
        !fresh ||
        !synced.authorizationRevision.hasValue(fresh.authorizationRevision)
      ) {
        return synced;
      }

      opening = { entry: fresh, session: synced };
    }

    const roots = DeviceSealedRootPayload.decode(
      (await this.verified(opening.session, opening.entry)).payload,
    );

    return {
      ...opening.session,
      deviceSealedRootGeneration: DeviceSealedRootGeneration.fromNumber(
        opening.entry.generation,
      ),
      deviceSealedRootKey: roots.root,
      ...(roots.previous
        ? { previousDeviceSealedRootKey: roots.previous }
        : {}),
    };
  }

  /**
   * Opens a fresh root on the device a recovery kit just authorized, for
   * recovery-key sign-in only. The recovery replaced every device, so the
   * root the keychain head is sealed under is no longer held by any
   * authorized device and cannot be opened. Refuses unless the signed
   * transitions, replayed here and never taken from the node's device list,
   * authorize this device alone, and seals the fresh root to that verified
   * device only. Always replaces an existing head, which cannot open under the
   * fresh root, with an empty keychain before publishing that root, so a
   * failed replacement publishes nothing and the recovery runs again. Unlock
   * and pairing use `current`, which never replaces a head.
   */
  public async openAfterRecovery(session: Session): Promise<Session> {
    if (session.deviceSealedRootKey) {
      throw new Error(
        'A recovered session must not hold a device-sealed root.',
      );
    }

    const devices = await this.deviceAuthorization.verifiedDevices(session);
    const own = session.deviceCredentialKeyPair.toPrimitives().publicKey;

    if (devices.length !== 1 || !devices[0].hasValue(own)) {
      throw new Error('Recovery left another device authorized.');
    }

    const root = SymmetricKey.generate();

    await this.keychains.replaceHeadAfterRecovery({
      ...session,
      deviceSealedRootKey: root,
    });

    return await this.publishWithRetry(session, { root }, devices);
  }

  /**
   * Seals a fresh root, carrying the root of this device's own entry, to the
   * devices that remain after this device's own retirement at the given
   * revision. Nothing is submitted: the generation rides in the retirement.
   * Returns `null` when this device holds no entry to hand over from.
   */
  public async handOver(
    session: Session,
    retirement: {
      authorizationRevision: number;
      recipients: readonly DeviceCredential[];
    },
  ): Promise<DeviceSealedRootHandOver | null> {
    const own = await this.ownEntry(session);

    if (!own) {
      return null;
    }

    const previous = DeviceSealedRootPayload.decode(own.payload).root;
    const root = SymmetricKey.generate();

    return {
      previous,
      root,
      sealedSecrets: this.sealedSecrets.sealHandOver(session, {
        authorizationRevision: retirement.authorizationRevision,
        generation: this.nextGeneration(own.generation),
        payload: DeviceSealedRootPayload.encode({ previous, root }),
        recipients: retirement.recipients,
      }),
    };
  }

  /** Generation of this device's sealed root entry; null without one. */
  public async generation(session: Session): Promise<number | null> {
    return (await this.ownEntry(session))?.generation ?? null;
  }
}
