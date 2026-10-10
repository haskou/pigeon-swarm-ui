import type {
  IdentityPresence,
  IdentityResource,
  KeychainResource,
  LocalKeychain,
  LoginResult,
  Session,
  SelectablePresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { DevicePairingRequestDraft } from '../../domain/DevicePairingRequestDraft';
import type { Identity } from '../../domain/Identity';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityCreationMaterial } from '../crypto/IdentityCreationMaterial';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';
import type { PigeonIdentityLoginApi } from './PigeonIdentityLoginApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';
import type { PigeonPresenceGateway } from './PigeonPresenceGateway';

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

    return await this.identityLogin.hydrate(session, onProgress);
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
    const result = await this.deviceAuthorization.authorizePairing(
      session,
      requestCode,
    );

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
    return await this.deviceAuthorization.revokeDevice(
      session,
      target,
      compromisedSince,
    );
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
    const session = await this.deviceAuthorization.completePairing(
      identity,
      password,
      draft,
      completionCode,
    );

    return await this.identityLogin.hydrate(session, onProgress);
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
    recoveryKey?: string,
  ): Promise<LoginResult> {
    return await this.identityLogin.login(
      identityId,
      password,
      onProgress,
      recoveryKey,
    );
  }

  public async hydrateSession(
    session: Session,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityLogin.hydrate(session, onProgress);
  }

  public async restoreSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
    return await this.identityLogin.restore(identityId, onProgress);
  }

  public async unlockSession(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<Session> {
    return await this.identityLogin.unlock(
      identityId,
      password,
      onProgress,
      recoveryKey,
    );
  }

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.keychain.publishKeychain(session, nextKeychain);
  }

  public async refreshIdentity(identityId: string): Promise<IdentityResource> {
    return await this.identityProfile.refresh(identityId);
  }

  public async refreshSession(session: Session): Promise<LoginResult> {
    return await this.identityLogin.refreshSession(session);
  }

  public async restoreRememberedSession(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<LoginResult> {
    return await this.identityLogin.restoreRememberedSession(
      identityId,
      onProgress,
    );
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
}
