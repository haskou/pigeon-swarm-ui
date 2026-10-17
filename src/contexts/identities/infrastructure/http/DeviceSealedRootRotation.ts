import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { DeviceSealedSecretPublisherStanding } from '../../domain/services/DeviceSealedSecretPublisherStanding';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { DeviceSealedRoots } from '../crypto/DeviceSealedRoots';
import type { OpenedDeviceSealedSecret } from '../crypto/OpenedDeviceSealedSecret';
import type { Session } from '../session/Session';
import type { DeviceSealedRootTrustStore } from '../storage/DeviceSealedRootTrustStore';
import type { DeviceSealedRootHandOver } from './DeviceSealedRootHandOver';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from './PigeonDeviceSealedSecretApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { RevokedDeviceSealedSecretPublisherError } from '../../domain/errors/RevokedDeviceSealedSecretPublisherError';
import { SupersededDeviceSealedRootHandOverError } from '../../domain/errors/SupersededDeviceSealedRootHandOverError';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceSealedRootGeneration } from '../../domain/value-objects/DeviceSealedRootGeneration';
import { DeviceSealedRootPayload } from '../crypto/DeviceSealedRootPayload';

/** How far past the clock a revoked publisher's generation still counts. */
const revokedGenerationHorizonMs = 86_400_000;

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
 * to the devices that remain, inside its own retirement. The secret API
 * decrypts an entry before any check, but no entry is used or trusted until
 * the signed transitions authorize its publisher at the entry revision and no
 * later transition revoked it. A hand-over is the first entry at its
 * revision, so one at or below the revision of another root this device
 * trusts is refused: the retired key could sign another. An entry whose
 * publisher a later transition revoked is used only while its root is the one
 * this device last opened from a trusted entry or published itself, and only
 * to move off that root: `current` never adopts it, so a device left behind
 * by a failed rotation rotates from it. Its generation, bounded to a day past
 * the clock, still orders the next publish. Any other entry they do not, or
 * cannot, authorize fails the call and leaves every local row as it was.
 */
export class DeviceSealedRootRotation {
  private static revoked(error: unknown): boolean {
    return error instanceof RevokedDeviceSealedSecretPublisherError;
  }

  public constructor(
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly sealedSecrets: PigeonDeviceSealedSecretApi,
    private readonly keychains: PigeonKeychainApi,
    private readonly trust: DeviceSealedRootTrustStore,
    private readonly clock: () => number = Date.now,
  ) {}

  private nextGeneration(stored: number | undefined): number {
    return Math.max(stored ?? 0, this.clock()) + 1;
  }

  /**
   * A revoked key may sign any generation, and the node keeps the highest;
   * honoured as is, one near `MAX_SAFE_INTEGER` leaves no generation above.
   */
  private bounded(entry: OpenedDeviceSealedSecret): OpenedDeviceSealedSecret {
    return {
      ...entry,
      generation: Math.min(
        entry.generation,
        this.clock() + revokedGenerationHorizonMs,
      ),
    };
  }

  /**
   * Never throws: trust only helps a device move off a revoked publisher and
   * order hand-overs. Without it, the device waits for a trusting device to
   * rotate or is paired again.
   */
  private remember(
    session: Session,
    root: SymmetricKey,
    revision: number,
  ): void {
    try {
      this.trust.remember(
        session.identity.id,
        session.masterKey,
        root,
        revision,
      );
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Could not remember the trusted device-sealed root');
    }
  }

  private trustsRevoked(
    session: Session,
    entry: OpenedDeviceSealedSecret,
    error: unknown,
  ): boolean {
    return (
      DeviceSealedRootRotation.revoked(error) &&
      this.trust.trusts(
        session.identity.id,
        session.masterKey,
        DeviceSealedRootPayload.decode(entry.payload).root,
      )
    );
  }

  private supersededHandOver(
    session: Session,
    entry: OpenedDeviceSealedSecret,
    standing: DeviceSealedSecretPublisherStanding,
  ): boolean {
    return (
      standing === 'retired' &&
      this.trust.supersedes(
        session.identity.id,
        session.masterKey,
        DeviceSealedRootPayload.decode(entry.payload).root,
        entry.authorizationRevision,
      )
    );
  }

  /**
   * Returns the entry once the signed transitions authorize its publisher at
   * the entry revision and no later transition revoked it, so a signature by
   * a key the node minted, or by a key revoked since, opens nothing. A
   * hand-over at or below the revision of another trusted root is refused. A
   * revoked publisher's entry still returns, marked revoked and with its
   * generation bounded, while its root is the one this device trusted.
   * Rejects otherwise, including when the transitions are not served.
   */
  private async verified(
    session: Session,
    entry: OpenedDeviceSealedSecret,
  ): Promise<{ entry: OpenedDeviceSealedSecret; revoked: boolean }> {
    let standing: DeviceSealedSecretPublisherStanding;

    try {
      standing = await this.deviceAuthorization.verifyPublisher(
        session,
        entry.publisherCredential,
        DeviceAuthorizationRevision.fromNumber(entry.authorizationRevision),
      );
    } catch (error: unknown) {
      if (!this.trustsRevoked(session, entry, error)) throw error;

      return { entry: this.bounded(entry), revoked: true };
    }

    assert(
      !this.supersededHandOver(session, entry, standing),
      new SupersededDeviceSealedRootHandOverError(),
    );

    return { entry, revoked: false };
  }

  /**
   * Generation of this device's own entry, to publish above it. An entry
   * whose publisher a later transition revoked still counts here, bounded,
   * as the node refuses a generation that is not above it; nothing else of
   * it is used.
   */
  private async storedGeneration(
    session: Session,
  ): Promise<number | undefined> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (!own) return undefined;

    try {
      return (await this.verified(session, own)).entry.generation;
    } catch (error: unknown) {
      if (!DeviceSealedRootRotation.revoked(error)) throw error;

      return this.bounded(own).generation;
    }
  }

  /**
   * This device's own entry with a verified publisher, its generation bounded
   * when that publisher was revoked since; null without one.
   */
  private async ownEntry(
    session: Session,
  ): Promise<OpenedDeviceSealedSecret | null> {
    const own = await this.sealedSecrets.fetchOwn(session);

    return own ? (await this.verified(session, own)).entry : null;
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
    const stored = await this.storedGeneration(session);
    const recipients = verifiedRecipients
      ? [...verifiedRecipients]
      : await this.deviceAuthorization.findDevices(session);
    const generation = this.nextGeneration(stored);

    await this.sealedSecrets.publish(session, {
      generation,
      payload: DeviceSealedRootPayload.encode(roots),
      recipients,
    });
    this.remember(session, roots.root, session.authorizationRevision.valueOf());

    return {
      ...session,
      deviceSealedRootGeneration:
        DeviceSealedRootGeneration.fromNumber(generation),
      deviceSealedRootKey: roots.root,
    };
  }

  /**
   * The session holding the root of the verified entry it was opened on. An
   * entry of a revoked publisher is never adopted: the session returns
   * synchronized and without a root, so the caller rotates off that root.
   */
  private async opened(opening: {
    entry: OpenedDeviceSealedSecret;
    session: Session;
    synchronized: boolean;
  }): Promise<Session> {
    const { entry, revoked } = await this.verified(
      opening.session,
      opening.entry,
    );

    if (revoked) {
      return opening.synchronized
        ? opening.session
        : await this.deviceAuthorization.synchronize(opening.session);
    }

    const roots = DeviceSealedRootPayload.decode(entry.payload);

    this.remember(opening.session, roots.root, entry.authorizationRevision);

    return {
      ...opening.session,
      deviceSealedRootGeneration: DeviceSealedRootGeneration.fromNumber(
        entry.generation,
      ),
      deviceSealedRootKey: roots.root,
      ...(roots.previous
        ? { previousDeviceSealedRootKey: roots.previous }
        : {}),
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
      (await this.verified(session, own)).entry.payload,
    ).root;
  }

  /**
   * Returns the session holding the root of the current generation, with
   * that generation, and the root a hand-over replaced. Publishes a new
   * generation only when this device has no entry at all and the keychain
   * head is readable. Returns the synchronized session without a root when
   * the entry lags the head or its publisher was revoked since.
   */
  public async current(session: Session): Promise<Session> {
    const own = await this.sealedSecrets.fetchOwn(session);

    if (!own) {
      await this.keychains.readHead(session);

      return await this.rotate(session);
    }

    if (session.authorizationRevision.hasValue(own.authorizationRevision)) {
      return await this.opened({ entry: own, session, synchronized: false });
    }

    const synced = await this.deviceAuthorization.synchronize(session);
    const fresh = await this.sealedSecrets.fetchOwn(synced);

    if (
      !fresh ||
      !synced.authorizationRevision.hasValue(fresh.authorizationRevision)
    ) {
      return synced;
    }

    return await this.opened({
      entry: fresh,
      session: synced,
      synchronized: true,
    });
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

  /** Forgets the root this device trusted, as when it was removed. */
  public forgetTrustedRoot(identityId: string): void {
    this.trust.forget(identityId);
  }

  /** Generation of this device's sealed root entry; null without one. */
  public async generation(session: Session): Promise<number | null> {
    return (await this.ownEntry(session))?.generation ?? null;
  }
}
