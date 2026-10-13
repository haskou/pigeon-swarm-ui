import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';
import type { Identity } from '../../domain/Identity';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityCreationMaterial } from '../crypto/IdentityCreationMaterial';
import type {
  LocalKeychain,
  LocalKeychainUpdate,
} from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { DeviceUnlockMethod } from '../storage/DeviceUnlockMethod';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { DevicePairingHistory } from './DevicePairingHistory';
import type { DeviceSealedRecovery } from './DeviceSealedRecovery';
import type { DeviceSealedRootRotation } from './DeviceSealedRootRotation';
import type { IdentityAdmissionProgressListener } from './IdentityAdmissionProgressListener';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type {
  OwnDeviceRetirement,
  PigeonDeviceAuthorizationApi,
} from './PigeonDeviceAuthorizationApi';
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

import { copy } from '../../../../shared/presentation/i18n/copy';
import { DevicePairingError } from '../../domain/DevicePairingError';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { IdentityPassword } from '../../domain/value-objects/IdentityPassword';
import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';

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
  ) {}

  public async recover(
    identityId: string,
    password: string,
    recoveryKey: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('resolving-identity');
    const identity = await this.identityProfile.get(identityId);
    onProgress?.('decrypting-keys');
    const session = await this.deviceAuthorization.recover(
      identity,
      RecoveryKey.fromString(recoveryKey),
      IdentityPassword.fromString(password),
    );

    return await this.identityLogin.hydrate(
      await this.openDeviceSealedRoot(session),
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

  public async authorizeDevicePairing(
    session: Session,
    requestCode: DevicePairingCode,
  ): Promise<{ completionCode: DevicePairingCode; session: Session }> {
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

    // Every completion carries the secret. A failed publish leaves the transfer
    // partial or absent, and the new device imports whatever was sent.
    const historyTransferSecret = SymmetricKey.generate();

    await this.pairingHistory.publish(
      opened,
      historyTransferSecret.getBuffer(),
    );

    const result = await this.deviceAuthorization.authorizePairing(
      opened,
      requestCode,
      historyTransferSecret,
    );
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

  public async retireOwnDevice(session: Session): Promise<OwnDeviceRetirement> {
    return await this.deviceAuthorization.retireOwnDevice(session);
  }

  public async completeDevicePairing(
    identityId: string,
    password: IdentityPassword,
    draft: DevicePairingRequestDraft,
    completionCode: DevicePairingCode,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    onProgress?.('resolving-identity');
    const identity = await this.identityProfile.get(identityId);
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
      paired.historyTransferSecret.getBuffer(),
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

  public async disablePasskeyUnlock(
    session: Session,
    nextPassword: string,
  ): Promise<void> {
    await this.identityCommands.disablePasskeyUnlock(session, nextPassword);
  }

  public async enablePasskeyUnlock(
    session: Session,
    currentPassword: string,
  ): Promise<void> {
    await this.identityCommands.enablePasskeyUnlock(session, currentPassword);
  }

  public async localUnlockMethod(
    identityId: string,
  ): Promise<DeviceUnlockMethod | undefined> {
    return await this.identityCommands.localUnlockMethod(identityId);
  }

  public async passkeyUnlockSecret(identityId: string): Promise<string> {
    return await this.identityCommands.passkeyUnlockSecret(identityId);
  }

  public async passkeyUnlockSupported(): Promise<boolean> {
    return await this.identityCommands.passkeyUnlockSupported();
  }

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { recoveryKey?: string } = {},
  ): Promise<IdentityResource> {
    return (
      await this.identityCommands.create(
        name,
        password,
        networks,
        handle,
        options,
      )
    ).identity;
  }

  public async createIdentityAggregate(
    identity: Identity,
    material: IdentityCreationMaterial,
    protection: IdentityMasterKeyProtection,
  ): Promise<CreatedIdentityMaterial> {
    return await this.identityCommands.createIdentity(
      identity,
      material,
      protection,
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

  public async getMany(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    return await this.presence.getMany(session, identityIds);
  }

  public async getPresence(
    session: Session,
    identityId: string,
  ): Promise<IdentityPresence> {
    return await this.presence.get(session, identityId);
  }

  public async getPresences(
    session: Session,
    identityIds: string[],
  ): Promise<IdentityPresence[]> {
    return await this.presence.getMany(session, identityIds);
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
