import { KeyPair, SHA256Hash, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, assert } from '@haskou/value-objects';

import type { LoginIdentityProgressReporter } from '../../application/login-identity/LoginIdentityProgressReporter';
import type { LocalKeychain } from '../keychain/LocalKeychain';
import type { Session } from '../session/Session';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { DeviceSealedRecovery } from './DeviceSealedRecovery';
import type { DeviceSealedRootRotation } from './DeviceSealedRootRotation';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';
import type { IdentityResource } from './resources/IdentityResource';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { LocalDeviceIdentityNotFoundError } from '../storage/LocalDeviceIdentityNotFoundError';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentitySessionApi {
  public constructor(
    private readonly identities: PigeonIdentityGateway,
    private readonly vault: DeviceIdentityVault,
    private readonly deviceAuthorization: PigeonDeviceAuthorizationApi,
    private readonly deviceSealedRoot: DeviceSealedRootRotation,
    private readonly recovery: DeviceSealedRecovery,
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

  /**
   * Opens the root of the current generation. A session left without one has
   * an entry behind the head, so this device mints the fresh generation that
   * a forgotten device could not publish.
   */
  private async openDeviceSealedRoot(session: Session): Promise<Session> {
    let opened: Session;

    try {
      opened = await this.deviceSealedRoot.current(session);
    } catch {
      // Count-only. Reads and publishes need the root until next unlock.
      // eslint-disable-next-line no-console
      console.debug('Device sealed root could not be opened.');

      return session;
    }

    return opened.deviceSealedRootKey
      ? opened
      : await this.recovery.rotateLaggingRoot(opened);
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
      vaultSession.authorizationRevision.isGreaterOrEqualThan(
        identity.authorizationRevision,
      ),
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
      identity.authorizationRevision !== 0 ||
        !vaultSession.authorizationRevision.isZero() ||
        genesisMatches,
      new Error(copy.auth.invalidLogin),
    );
  }

  public async unlock(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
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
    } catch (error) {
      if (error instanceof LocalDeviceIdentityNotFoundError) {
        throw new Error(copy.auth.localDeviceMissing);
      }

      throw new Error(copy.auth.invalidLogin);
    }

    const synchronized = await this.deviceAuthorization.synchronize(
      this.createSession(identity, vaultSession),
    );
    await this.recovery.resumeRootReseal(synchronized);

    const rooted = await this.openDeviceSealedRoot(synchronized);
    await this.recovery.resumeKeychainRewrap(rooted);

    return rooted;
  }
}
