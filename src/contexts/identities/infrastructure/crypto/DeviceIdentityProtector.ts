import {
  KeyPair,
  ProtectedUserRootKey,
  SymmetricKey,
  UserRootKey,
  UserRootKeySecondFactor,
} from '@haskou/pigeon-swarm-crypto';
import {
  InvalidFormatError,
  StringValueObject,
  assert,
} from '@haskou/value-objects';

import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DeviceIdentityKeyMaterial } from './DeviceIdentityKeyMaterial';
import type { ProtectDeviceIdentityInput } from './ProtectDeviceIdentityInput';
import type { ProtectedDeviceIdentity } from './ProtectedDeviceIdentity';
import type { SerializedDeviceIdentityKeyMaterial } from './SerializedDeviceIdentityKeyMaterial';

import { DeviceRootKeyEnvelope as RootKeyEnvelope } from '../../domain/value-objects/DeviceRootKeyEnvelope';

const FACTOR_KEY_BITS = 256;
const MATERIAL_VERSION = 1;

export class DeviceIdentityProtector {
  private context(protectedIdentity: {
    deviceId: DeviceId;
    identityId: IdentityId;
    secretHandle: DeviceUnlockSecretHandle;
  }): StringValueObject {
    return new StringValueObject(
      [
        'pigeon-swarm:device-unlock-factor:v1',
        protectedIdentity.identityId.valueOf(),
        protectedIdentity.deviceId.valueOf(),
        protectedIdentity.secretHandle.valueOf(),
      ].join('\n'),
    );
  }

  private async factor(
    factorKey: CryptoKey,
    protectedIdentity: {
      deviceId: DeviceId;
      identityId: IdentityId;
      secretHandle: DeviceUnlockSecretHandle;
    },
  ): Promise<UserRootKeySecondFactor> {
    const signature = await crypto.subtle.sign(
      'HMAC',
      factorKey,
      new TextEncoder().encode(this.context(protectedIdentity).valueOf()),
    );

    return UserRootKeySecondFactor.fromBuffer(new Uint8Array(signature));
  }

  private serialize(
    material: DeviceIdentityKeyMaterial,
  ): SerializedDeviceIdentityKeyMaterial {
    return {
      deviceCredentialKeyPair: material.deviceCredentialKeyPair.toPrimitives(),
      identityKeyPair: material.identityKeyPair.toPrimitives(),
      recoveryAuthorityKeyPair:
        material.recoveryAuthorityKeyPair.toPrimitives(),
      version: MATERIAL_VERSION,
    };
  }

  private restore(
    serialized: SerializedDeviceIdentityKeyMaterial,
    rootKey: UserRootKey,
  ): DeviceIdentityKeyMaterial {
    assert(
      serialized.version === MATERIAL_VERSION,
      new InvalidFormatError('[redacted device identity material]'),
    );

    return {
      deviceCredentialKeyPair: KeyPair.fromPrimitives(
        serialized.deviceCredentialKeyPair,
      ),
      identityKeyPair: KeyPair.fromPrimitives(serialized.identityKeyPair),
      recoveryAuthorityKeyPair: KeyPair.fromPrimitives(
        serialized.recoveryAuthorityKeyPair,
      ),
      rootKey,
    };
  }

  public async protect(
    input: ProtectDeviceIdentityInput,
  ): Promise<ProtectedDeviceIdentity> {
    const factorKey = await crypto.subtle.generateKey(
      { hash: 'SHA-256', length: FACTOR_KEY_BITS, name: 'HMAC' },
      false,
      ['sign'],
    );
    const identity = {
      deviceId: input.deviceId,
      identityId: input.identityId,
      secretHandle: input.secretHandle,
    };
    const factor = await this.factor(factorKey, identity);
    const envelope = RootKeyEnvelope.fromProtectedUserRootKey(
      await ProtectedUserRootKey.create(
        input.material.rootKey,
        input.password,
        factor,
      ),
    );
    const rootCipher = SymmetricKey.fromBuffer(
      input.material.rootKey.getBuffer(),
    );
    const encryptedMaterial = rootCipher.encrypt(
      JSON.stringify(this.serialize(input.material)),
      { aad: this.context(identity) },
    );

    return { ...identity, encryptedMaterial, envelope, factorKey };
  }

  public async rewrap(
    protectedIdentity: ProtectedDeviceIdentity,
    currentPassword: string,
    nextPassword: string,
  ): Promise<ProtectedDeviceIdentity> {
    const factor = await this.factor(
      protectedIdentity.factorKey,
      protectedIdentity,
    );
    const envelope = RootKeyEnvelope.fromProtectedUserRootKey(
      await protectedIdentity.envelope
        .getProtectedUserRootKey()
        .rewrap(currentPassword, factor, nextPassword, factor),
    );

    return { ...protectedIdentity, envelope };
  }

  public async unlock(
    protectedIdentity: ProtectedDeviceIdentity,
    password: string,
  ): Promise<DeviceIdentityKeyMaterial> {
    const factor = await this.factor(
      protectedIdentity.factorKey,
      protectedIdentity,
    );
    const rootKey = await protectedIdentity.envelope
      .getProtectedUserRootKey()
      .unlock(password, factor);
    const serialized = JSON.parse(
      SymmetricKey.fromBuffer(rootKey.getBuffer())
        .decrypt(protectedIdentity.encryptedMaterial, {
          aad: this.context(protectedIdentity),
        })
        .toString('utf8'),
    ) as SerializedDeviceIdentityKeyMaterial;

    return this.restore(serialized, rootKey);
  }
}
