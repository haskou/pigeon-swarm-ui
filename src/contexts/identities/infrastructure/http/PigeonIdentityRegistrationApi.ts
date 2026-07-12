import type {
  LocalKeychain,
  LoginResult,
} from '../../../../shared/domain/pigeonResources.types';
import type { RegisterIdentityPort } from '../../application/ports/RegisterIdentityPort';
import type { ProfileHandle } from '../../domain/profile/ProfileHandle';
import type { ProfileName } from '../../domain/profile/ProfileName';
import type { IdentityNetworkMemberships } from '../../domain/value-objects/IdentityNetworkMemberships';
import type { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { PigeonIdentityCommandsApi } from './PigeonIdentityCommandsApi';
import type { PigeonIdentityWorkspaceSessionApi } from './PigeonIdentityWorkspaceSessionApi';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentityRegistrationApi implements RegisterIdentityPort {
  public constructor(
    private readonly commands: PigeonIdentityCommandsApi,
    private readonly workspace: PigeonIdentityWorkspaceSessionApi,
    private readonly keyProtection: PigeonIdentityKeyProtectionGateway,
  ) {}

  private async createMaterial(
    name: string,
    password: string,
    networks: string[],
    handle: string | undefined,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string },
  ): Promise<CreatedIdentityMaterial> {
    return await this.commands.create(
      name,
      password,
      networks,
      handle,
      options,
    );
  }

  private async saveOptionalLocalPasskeyUnlock(
    material: CreatedIdentityMaterial,
    password: string,
    passkeyPrfEnabled?: boolean,
  ): Promise<void> {
    if (
      !passkeyPrfEnabled ||
      material.identity.masterKeyDerivation.passkeyPrf
    ) {
      return;
    }

    await this.keyProtection
      .saveLocalPasskeyMasterKeyUnlock({
        displayName: material.identity.profile.name,
        identityId: material.identity.id,
        masterKey: material.masterKey,
        password,
      })
      .catch(() => undefined);
  }

  public async register(
    name: ProfileName,
    password: string,
    networks: IdentityNetworkMemberships,
    handle?: ProfileHandle,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<LoginResult> {
    const material = await this.createMaterial(
      name.toString(),
      password,
      networks.toPrimitives(),
      handle?.toString(),
      options,
    );
    const result = await this.workspace.hydrate({
      identity: material.identity,
      keychain: emptyKeychain,
      keyPair: material.keyPair,
      masterKey: material.masterKey,
    });

    await this.saveOptionalLocalPasskeyUnlock(
      material,
      password,
      options.passkeyPrfEnabled,
    );

    return result;
  }
}
