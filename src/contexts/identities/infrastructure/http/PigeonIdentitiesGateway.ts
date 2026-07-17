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
import type { Identity } from '../../domain/Identity';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityCreationMaterial } from '../crypto/IdentityCreationMaterial';
import type { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';
import type { PigeonIdentityLoginApi } from './PigeonIdentityLoginApi';
import type { PigeonKeychainApi } from './PigeonKeychainApi';
import type { PigeonPresenceGateway } from './PigeonPresenceGateway';

export class PigeonIdentitiesGateway {
  public constructor(
    private readonly identityCommands: PigeonIdentityCommandsApi,
    private readonly identityLogin: PigeonIdentityLoginApi,
    private readonly identityProfile: PigeonIdentityGateway,
    private readonly keyProtection: PigeonIdentityKeyProtectionGateway,
    private readonly keychain: PigeonKeychainApi,
    private readonly presence: PigeonPresenceGateway,
  ) {}

  public async configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void> {
    await this.keyProtection.configureLocalPasskeyUnlock(
      session,
      password,
      enabled,
      recoveryKey,
    );
  }

  public async createIdentity(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
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
      passkeyPrfEnabled?: boolean;
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
