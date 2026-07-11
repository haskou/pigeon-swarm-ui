import type { LoginIdentityProgressReporter } from '../../contexts/identities/application/ports/LoginIdentityProgressReporter';
import type { IdentityUpdateProfileInput } from '../../contexts/identities/domain/IdentitySignaturePayloadFactory';
import type {
  IdentityPresence,
  IdentityResource,
  LocalKeychain,
  LoginResult,
  Session,
  SelectablePresenceStatus,
} from '../../shared/domain/pigeonResources.types';

import { LoginIdentity } from '../../contexts/identities/application/login-identity/LoginIdentity';
import { LoginIdentityMessage } from '../../contexts/identities/application/login-identity/messages/LoginIdentityMessage';
import { RegisterIdentityMessage } from '../../contexts/identities/application/register-identity/messages/RegisterIdentityMessage';
import { RegisterIdentity } from '../../contexts/identities/application/register-identity/RegisterIdentity';
import { PigeonPresenceGateway } from './gateways/PigeonPresenceGateway';
import { PigeonApiGateway } from './PigeonApiGateway';

export class PigeonIdentitiesApplication {
  private readonly loginIdentity: LoginIdentity;

  private readonly registerIdentity: RegisterIdentity;

  public constructor(
    private readonly gateway: PigeonApiGateway,
    private readonly presence: PigeonPresenceGateway,
  ) {
    this.loginIdentity = new LoginIdentity(gateway);
    this.registerIdentity = new RegisterIdentity({
      register: async (name, password, networks, handle, options) =>
        await gateway.register(
          name.toString(),
          password,
          networks.toPrimitives(),
          handle?.toString(),
          options,
        ),
    });
  }

  public async configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void> {
    await this.gateway.configureLocalPasskeyUnlock(
      session,
      password,
      enabled,
      recoveryKey,
    );
  }

  public async get(identityId: string): Promise<IdentityResource> {
    return await this.gateway.getIdentity(identityId);
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
    return await this.gateway.publishKeychain(session, nextKeychain);
  }

  public async refresh(identityId: string): Promise<IdentityResource> {
    return await this.gateway.refreshIdentity(identityId);
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
    return await this.gateway.updateIdentityProfile(
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
