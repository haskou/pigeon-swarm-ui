import {
  KeyPair,
  StringValueObject,
  SymmetricKey,
} from '@haskou/value-objects';

import type {
  IdentityResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { LoginIdentityProgressReporter } from '../../application/ports/LoginIdentityProgressReporter';
import type { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { loadLocalDeviceUnlock } from '../storage/localDeviceUnlock';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentitySessionApi {
  public constructor(
    private readonly identities: PigeonIdentityGateway,
    private readonly keyProtection: PigeonIdentityKeyProtectionGateway,
  ) {}

  private createLoginPayload(identity: IdentityResource): StringValueObject {
    return new StringValueObject(`pigeon-swarm:login:${identity.id}`);
  }

  private createSession(
    identity: IdentityResource,
    keyPair: KeyPair,
    masterKey: SymmetricKey,
  ): Session {
    return {
      identity,
      keychain: emptyKeychain,
      keyPair,
      masterKey,
    };
  }

  private validateKeyPair(identity: IdentityResource, keyPair: KeyPair): void {
    const loginPayload = this.createLoginPayload(identity);

    if (!keyPair.isValidSignature(loginPayload, keyPair.sign(loginPayload))) {
      throw new Error(copy.auth.invalidLogin);
    }
  }

  public async unlock(
    identityId: string,
    password: string,
    onProgress?: LoginIdentityProgressReporter,
    recoveryKey?: string,
  ): Promise<Session> {
    onProgress?.('resolving-identity');
    const identity = await this.identities.get(identityId.trim());
    onProgress?.('decrypting-keys');

    if (this.keyProtection.shouldConfirmPasskey(identity, recoveryKey)) {
      onProgress?.('confirming-passkey');
    }

    const masterKey = await this.keyProtection.unlockLoginMasterKey({
      identity,
      password,
      recoveryKey,
    });
    let keyPair: KeyPair;

    try {
      keyPair = this.keyProtection.unlockIdentityKeyPair(identity, masterKey);
      this.validateKeyPair(identity, keyPair);
    } catch {
      throw new Error(copy.auth.invalidLogin);
    }

    return this.createSession(identity, keyPair, masterKey);
  }

  public async restoreRemembered(
    identityId: string,
    onProgress?: LoginIdentityProgressReporter,
  ): Promise<Session> {
    onProgress?.('resolving-identity');
    const identity = await this.identities.get(identityId.trim());
    onProgress?.('decrypting-keys');

    const localUnlock = await loadLocalDeviceUnlock(identity.id);

    if (!localUnlock) {
      throw new Error(copy.auth.invalidLogin);
    }

    const keyPair = KeyPair.fromPrimitives(localUnlock.keyPair);

    try {
      this.validateKeyPair(identity, keyPair);
    } catch {
      throw new Error(copy.auth.invalidLogin);
    }

    return this.createSession(
      identity,
      keyPair,
      SymmetricKey.fromBase64(localUnlock.masterKey),
    );
  }
}
