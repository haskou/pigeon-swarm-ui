import { RecoveryKey, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';
import type { Identity } from '../../domain/Identity';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { DevicePairingHistoryPolicy } from '../../domain/value-objects/DevicePairingHistoryPolicy';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityRegistrationCode } from '../../domain/value-objects/IdentityRegistrationCode';
import type { IdentityCreationMaterial } from '../crypto/IdentityCreationMaterial';
import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { DevicePairingHistory } from './DevicePairingHistory';
import type { DevicePairingReaders } from './DevicePairingReaders';
import type { DeviceSealedRecovery } from './DeviceSealedRecovery';
import type { DeviceSealedRootHandOver } from './DeviceSealedRootHandOver';
import type { DeviceSealedRootRotation } from './DeviceSealedRootRotation';
import type { IdentityAdmissionProgressListener } from './IdentityAdmissionProgressListener';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type { OwnDeviceRetirement } from './OwnDeviceRetirement';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';
import type { PigeonIdentityLoginApi } from './PigeonIdentityLoginApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';
import type { PigeonPresenceGateway } from './PigeonPresenceGateway';
import type { IdentityPresenceResource as IdentityPresence } from './resources/IdentityPresenceResource';
import type { IdentityResource } from './resources/IdentityResource';
import type { KeychainResource } from './resources/KeychainResource';
import type { LoginResult } from './resources/LoginResult';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from './resources/SelectablePresenceStatusResource';

import { retryReplicatedStateRead } from '../../../../shared/infrastructure/http/retryReplicatedStateRead';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { DevicePairingError } from '../../domain/DevicePairingError';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { IdentityPassword } from '../../domain/value-objects/IdentityPassword';

export class PigeonIdentitiesGateway {
  public constructor(
    private readonly identityCommands: PigeonIdentityCommandsApi,
    private readonly identityLogin: PigeonIdentityLoginApi,
    private readonly identityProfile: PigeonIdentityGateway,
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly keychain: PigeonKeychainApi,
    private readonly presence: PigeonPresenceGateway,
    private readonly deviceSealedRoot: DeviceSealedRootRotation,
    private readonly recovery: DeviceSealedRecovery,
    private readonly pairingHistory: DevicePairingHistory,
    private readonly pairingReaders: DevicePairingReaders,
  ) {}

  public async recover(
    identityId: string,
    password: string,
    recoveryKey: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('resolving-identity');
    const identity = await retryReplicatedStateRead(
      async () => await this.identityProfile.get(identityId),
      { onNotReady: () => onProgress?.('node-starting') },
    );
    onProgress?.('decrypting-keys');
    const session = await this.deviceAuthorization.recover(
      identity,
      RecoveryKey.fromString(recoveryKey),
      IdentityPassword.fromString(password),
    );

    // Only after the recovery kit proved itself and replaced every device:
    // the keychain root left with them, so this device opens a fresh one.
    return await this.identityLogin.hydrate(
      await this.deviceSealedRoot.openAfterRecovery(session),
      onProgress,
    );
  }

  public createDevicePairingInvitation(session: Session): DevicePairingCode {
    return this.deviceAuthorization.invite(session).toCode();
  }

  public async createDevicePairingRequest(
    invitationCode: DevicePairingCode,
  ): Promise<DevicePairingRequestDraft> {
    return await this.deviceAuthorization.requestPairing(invitationCode);
  }

  public async verifyDevicePairingRequest(
    requestCode: DevicePairingCode,
  ): Promise<string> {
    return await this.deviceAuthorization.verifyPairingRequest(requestCode);
  }

  /**
   * `historyPolicy` bounds the stored history this device exports to the new
   * one. Inbox records the node still holds reach the new device whatever the
   * policy.
   */
  public async authorizeDevicePairing(
    session: Session,
    requestCode: DevicePairingCode,
    password: string,
    historyPolicy: DevicePairingHistoryPolicy,
  ): Promise<{ completionCode: DevicePairingCode; session: Session }> {
    // The new device receives the identity root and the history secret, so
    // the person types the password for this device again. A refusal sends
    // nothing.
    await this.identityCommands.confirmLocalUnlock(
      session.identity.id,
      password,
    );
    // A session that holds no root (a registered device, or one never unlocked
    // here) opens it first. `current` never mints over a keychain head it
    // cannot read, so an unreadable head refuses here instead of re-rooting.
    const opened = session.deviceSealedRootKey
      ? session
      : await this.deviceSealedRoot.current(session);
    const root = opened.deviceSealedRootKey;

    if (!root) {
      throw new DevicePairingError(
        'mismatch',
        'Device sealed root is not open on this session.',
      );
    }

    // Every completion carries the secret. The floor bounds only this
    // device's export: a failed publish leaves the transfer partial or absent,
    // and the new device imports whatever was sent.
    const historyTransferSecret = SymmetricKey.generate();
    const historyFloor = historyPolicy.floorAt(Timestamp.now());

    await this.pairingHistory.publish(
      opened,
      historyTransferSecret,
      historyFloor,
    );

    const result = await this.deviceAuthorization.authorizePairing(
      opened,
      requestCode,
      historyTransferSecret,
    );
    // The new device's reader is enrolled in every direct inbox before it gets
    // the completion code, so a message this device acknowledges before the
    // new device's first open is kept for it. Never throws.
    await this.pairingReaders.enrol(result.session, result.credential);
    // The root is kept, so the new device opens the keychain's root. A failed
    // reseal is recorded and retried on the next unlock, and the completion
    // code is still returned.
    await this.recovery.resealAfterPairing(result.session, root);

    return {
      completionCode: result.completion.toCode(),
      session: result.session,
    };
  }

  public async listDevices(session: Session): Promise<DeviceCredential[]> {
    return await this.deviceAuthorization.findDevices(session);
  }

  public async synchronizeDeviceAuthorization(
    session: Session,
  ): Promise<Session> {
    return await this.deviceAuthorization.synchronize(session);
  }

  public async revokeDevice(
    session: Session,
    target: DeviceCredential,
    compromisedSince?: DeviceAuthorizationRevision,
  ): Promise<Session> {
    // The head is read under the current root first, so a failed read revokes
    // nothing. The root that keeps the keychain readable is recorded before the
    // revoke, so a failed rewrap is retried on the next unlock.
    const head = await this.keychain.readHead(session);

    if (head) {
      this.recovery.rememberKeychainRewrap(session);
    }

    const revoked = await this.deviceAuthorization.revokeDevice(
      session,
      target,
      compromisedSince,
    );
    const rotated = await this.deviceSealedRoot.rotate(revoked);

    if (head) {
      await this.recovery.rewrapAfterRevoke(rotated, head);
    }

    return rotated;
  }

  /**
   * Removes this device and, when other devices remain, rotates the sealed
   * root in the same transition: a fresh root, carrying the root it replaces,
   * is sealed to the remaining devices and the keychain head moves under it
   * once the node confirms it stored the generation. A hand-over that cannot
   * be prepared or is not stored leaves the rotation to the next remaining
   * device that unlocks.
   */
  public async retireOwnDevice(session: Session): Promise<OwnDeviceRetirement> {
    const revocation =
      await this.deviceAuthorization.prepareOwnRetirement(session);

    if (typeof revocation === 'string') {
      return revocation;
    }

    let handOver: DeviceSealedRootHandOver | null;

    try {
      handOver = await this.deviceSealedRoot.handOver(session, {
        authorizationRevision: revocation.transition
          .getResultRevision()
          .valueOf(),
        recipients: revocation.remaining,
      });
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Sealed root hand-over could not be prepared.');
      handOver = null;
    }

    const delivered = await this.deviceAuthorization.retireOwnDevice(
      session,
      revocation,
      handOver?.sealedSecrets,
    );

    if (!handOver || !delivered) {
      return 'revoked';
    }

    try {
      // Identity-signed, so it still lands after this device's revocation.
      await this.keychain.rewrapHeadSealedUnder(
        { ...session, deviceSealedRootKey: handOver.root },
        handOver.previous,
      );
    } catch {
      // eslint-disable-next-line no-console
      console.debug(
        'Keychain rewrap after hand-over failed; a remaining device moves it.',
      );
    }

    return 'revoked';
  }

  /** Drops the device-sealed steps a removed device can never resume. */
  public discardDeviceSealedRecovery(identityId: string): void {
    this.recovery.discard(identityId);
  }

  public async completeDevicePairing(
    identityId: string,
    password: IdentityPassword,
    draft: DevicePairingRequestDraft,
    completionCode: DevicePairingCode,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('resolving-identity');
    const identity = await retryReplicatedStateRead(
      async () => await this.identityProfile.get(identityId),
      { onNotReady: () => onProgress?.('node-starting') },
    );
    onProgress?.('decrypting-keys');
    const paired = await this.deviceAuthorization.completePairing(
      identity,
      password,
      draft,
      completionCode,
    );
    // Keychain heads open only under the device sealed root, which the
    // authorizer resealed to this device before handing out the completion.
    const rooted = await this.deviceSealedRoot.current(paired.session);

    if (!rooted.deviceSealedRootKey) {
      throw new DevicePairingError(
        'mismatch',
        'Device sealed root is not open on the paired device.',
      );
    }

    const result = await this.identityLogin.hydrate(rooted, onProgress);

    await this.pairingHistory.receive(
      result.session,
      paired.historyTransferSecret,
    );

    return result;
  }

  public async changePassword(
    session: Session,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    await this.identityCommands.changePassword(
      session,
      currentPassword,
      nextPassword,
    );
  }

  public async confirmLocalUnlock(
    identityId: string,
    password: string,
  ): Promise<void> {
    await this.identityCommands.confirmLocalUnlock(identityId, password);
  }

  public async createIdentityAggregate(
    identity: Identity,
    material: IdentityCreationMaterial,
    protection: IdentityMasterKeyProtection,
    registrationCode: IdentityRegistrationCode | null,
  ): Promise<CreatedIdentityMaterial> {
    return await this.identityCommands.createIdentity(
      identity,
      material,
      protection,
      registrationCode,
    );
  }

  public decryptKeychain(
    session: Session,
    keychain: KeychainResource,
  ): LocalKeychain {
    return this.keychain.decrypt(session, keychain);
  }

  /** Opens the device-sealed root and refuses a session left without one. */
  public async openDeviceSealedRoot(session: Session): Promise<Session> {
    const opened = await this.deviceSealedRoot.current(session);

    if (!opened.deviceSealedRootKey) {
      throw new Error(copy.auth.deviceRootUnavailable);
    }

    return opened;
  }

  public async getIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identityProfile.get(identityId);
  }

  public async get(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async getPresence(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async loadRemoteKeychain(session: Session): Promise<KeychainResource> {
    return await this.keychain.load(session);
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityLogin.login(identityId, password, onProgress);
  }

  public async hydrateSession(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityLogin.hydrate(session, onProgress);
  }

  public async unlockSession(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
    return await this.identityLogin.unlock(identityId, password, onProgress);
  }

  public async publishKeychain(
    session: Session,
    update: LocalKeychainUpdate,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.keychain.publishKeychain(session, update);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identityProfile.refresh(identityId);
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    return await this.identityLogin.refreshSession(session);
  }

  public async updateIdentityProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options: {
      currentPassword?: string;
      recoveryKey?: string;
    } = {},
  ): Promise<IdentityResource> {
    return await this.identityCommands.updateProfile(
      session,
      profile,
      newPassword,
      options,
    );
  }

  public async update(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, status);
  }

  public async updatePresence(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, status);
  }

  public async deviceSealedRootGeneration(
    session: Session,
  ): Promise<number | null> {
    return await this.deviceSealedRoot.generation(session);
  }

  public watchAdmissionProgress(
    listener: IdentityAdmissionProgressListener,
  ): () => void {
    return this.identityCommands.watchAdmissionProgress(listener);
  }
}
