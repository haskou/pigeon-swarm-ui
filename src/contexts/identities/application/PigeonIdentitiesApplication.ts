import type {
  IdentityPresence,
  IdentityResource,
  LocalKeychain,
  LoginResult,
  Session,
  SelectablePresenceStatus,
} from '../../../shared/domain/pigeonResources.types';
import type { IdentityUpdateProfileInput } from '../domain/IdentitySignaturePayloadFactory';
import type { IdentityProtectionPort } from './configure-local-passkey-unlock/IdentityProtectionPort';
import type { LoginIdentityPort } from './login-identity/LoginIdentityPort';
import type { LoginIdentityProgressReporter } from './login-identity/LoginIdentityProgressReporter';
import type { IdentityPresencePort } from './presence/IdentityPresencePort';
import type { IdentityProfilePort } from './profile/IdentityProfilePort';
import type { IdentityKeychainPort } from './publish-keychain/IdentityKeychainPort';
import type { RegisterIdentityPort } from './register-identity/RegisterIdentityPort';

import { LoginIdentity } from './login-identity/LoginIdentity';
import { LoginIdentityMessage } from './login-identity/messages/LoginIdentityMessage';
import { RegisterIdentityMessage } from './register-identity/messages/RegisterIdentityMessage';
import { RegisterIdentity } from './register-identity/RegisterIdentity';

export class PigeonIdentitiesApplication {
  private readonly loginIdentity: LoginIdentity;

  private readonly registerIdentity: RegisterIdentity;

  private readonly keychain: IdentityKeychainPort;

  private readonly presence: IdentityPresencePort;

  private readonly profile: IdentityProfilePort;

  private readonly protection: IdentityProtectionPort;

  public constructor(dependencies: {
    keychain: IdentityKeychainPort;
    login: LoginIdentityPort;
    presence: IdentityPresencePort;
    profile: IdentityProfilePort;
    protection: IdentityProtectionPort;
    register: RegisterIdentityPort;
  }) {
    this.keychain = dependencies.keychain;
    this.presence = dependencies.presence;
    this.profile = dependencies.profile;
    this.protection = dependencies.protection;
    this.loginIdentity = new LoginIdentity(dependencies.login);
    this.registerIdentity = new RegisterIdentity(dependencies.register);
  }

  public async configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void> {
    await this.protection.configureLocalPasskeyUnlock(
      session,
      password,
      enabled,
      recoveryKey,
    );
  }

  public async get(identityId: string): Promise<IdentityResource> {
    return await this.profile.getIdentity(identityId);
  }

  public async login(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<LoginResult> {
    return await this.loginIdentity.login(
      new LoginIdentityMessage({
        identityId,
        onProgress,
        password,
        recoveryKey,
      }),
    );
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

  public async publishKeychain(
    session: Session,
    nextKeychain: LocalKeychain,
  ): Promise<{ keychain: LocalKeychain; keychainExternalIdentifier: string }> {
    return await this.keychain.publishKeychain(session, nextKeychain);
  }

  public async refresh(identityId: string): Promise<IdentityResource> {
    return await this.profile.refreshIdentity(identityId);
  }

  public async register(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    return await this.registerIdentity.register(
      new RegisterIdentityMessage({
        handle,
        name,
        networks,
        passkeyPrfEnabled: options.passkeyPrfEnabled,
        password,
        recoveryKey: options.recoveryKey,
      }),
    );
  }

  public async updateProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword?: string,
    options: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    } = {},
  ): Promise<IdentityResource> {
    return await this.profile.updateIdentityProfile(
      session,
      profile,
      newPassword,
      options,
    );
  }

  public async updatePresence(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence> {
    return await this.presence.update(session, status);
  }
}
