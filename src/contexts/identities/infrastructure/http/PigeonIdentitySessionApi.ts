import { KeyPair, SHA256Hash, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import type {
  IdentityResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityId } from '../../domain/value-objects/IdentityId';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentitySessionApi {
  public constructor(
    private readonly identities: PigeonIdentityGateway,
    private readonly vault: DeviceIdentityVault,
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
  ) {}

  private createLoginPayload(identity: IdentityResource): StringValueObject {
    return new StringValueObject(`pigeon-swarm:login:${identity.id}`);
  }

  private createSession(
    identity: IdentityResource,
    vaultSession: Awaited<ReturnType<DeviceIdentityVault['unlock']>>,
  ): Session {
    return {
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceCredentialKeyPair: vaultSession.material.deviceCredentialKeyPair,
      deviceId: vaultSession.deviceId,
      identity,
      keychain: emptyKeychain,
      keyPair: vaultSession.material.identityKeyPair,
      masterKey: SymmetricKey.fromBuffer(
        vaultSession.material.rootKey.getBuffer(),
      ),
      recoveryAuthorityKeyPair: vaultSession.material.recoveryAuthorityKeyPair,
    };
  }

  private validateKeyPair(identity: IdentityResource, keyPair: KeyPair): void {
    if (
      !IdentityId.fromString(keyPair.toPrimitives().publicKey).isEqual(
        IdentityId.fromString(identity.id),
      )
    ) {
      throw new Error(copy.auth.invalidLogin);
    }

    const loginPayload = this.createLoginPayload(identity);

    if (!keyPair.isValidSignature(loginPayload, keyPair.sign(loginPayload))) {
      throw new Error(copy.auth.invalidLogin);
    }
  }

  private validateAuthorization(
    identity: IdentityResource,
    vaultSession: Awaited<ReturnType<DeviceIdentityVault['unlock']>>,
  ): void {
    assert(
      vaultSession.authorizationRevision.valueOf() >=
        identity.authorizationRevision,
      new Error(copy.auth.invalidLogin),
    );

    const deviceCredential =
      vaultSession.material.deviceCredentialKeyPair.toPrimitives().publicKey;
    const recoveryAuthority =
      vaultSession.material.recoveryAuthorityKeyPair.toPrimitives().publicKey;
    const genesisMatches =
      identity.deviceCredential === deviceCredential &&
      identity.deviceCredentialCommitment ===
        SHA256Hash.from(new StringValueObject(deviceCredential)).valueOf() &&
      identity.recoveryAuthority === recoveryAuthority;

    assert(
      identity.authorizationRevision !== 0 || genesisMatches,
      new Error(copy.auth.invalidLogin),
    );
  }

  public async unlock(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<Session> {
    void recoveryKey;
    onProgress?.('resolving-identity');
    const identity = await this.identities.get(identityId.trim());
    onProgress?.('decrypting-keys');

    let vaultSession: Awaited<ReturnType<DeviceIdentityVault['unlock']>>;

    try {
      vaultSession = await this.vault.unlock(
        IdentityId.fromString(identity.id),
        password,
      );
      this.validateKeyPair(identity, vaultSession.material.identityKeyPair);
      this.validateAuthorization(identity, vaultSession);
    } catch {
      throw new Error(copy.auth.invalidLogin);
    }

    return await this.deviceAuthorization.synchronize(
      this.createSession(identity, vaultSession),
    );
  }

  public restoreRemembered(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
    void identityId;
    void onProgress;

    return Promise.reject(new Error(copy.auth.invalidLogin));
  }
}
