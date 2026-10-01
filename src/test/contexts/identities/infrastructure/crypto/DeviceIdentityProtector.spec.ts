import { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceIdentityProtector } from '../../../../../contexts/identities/infrastructure/crypto/DeviceIdentityProtector';

describe(DeviceIdentityProtector.name, () => {
  async function material() {
    return {
      deviceCredentialKeyPair: await KeyPair.generate(),
      identityKeyPair: await KeyPair.generate(),
      recoveryAuthorityKeyPair: await KeyPair.generate(),
      rootKey: UserRootKey.generate(),
    };
  }

  it('requires the password and non-exportable device factor to unlock', async () => {
    const protector = new DeviceIdentityProtector();
    const source = await material();
    const protectedIdentity = await protector.protect({
      deviceId: DeviceId.generate(),
      identityId: IdentityId.fromString(
        source.identityKeyPair.toPrimitives().publicKey,
      ),
      material: source,
      password: 'correct horse battery staple',
      secretHandle: DeviceUnlockSecretHandle.generate(),
    });

    expect(
      protectedIdentity.identityId.getPublicKey().valueOf() ===
        source.identityKeyPair.toPrimitives().publicKey,
    ).toBe(true);

    await expect(
      crypto.subtle.exportKey('raw', protectedIdentity.factorKey),
    ).rejects.toThrow();
    await expect(
      protector.unlock(protectedIdentity, 'wrong password'),
    ).rejects.toThrow();

    const unlocked = await protector.unlock(
      protectedIdentity,
      'correct horse battery staple',
    );

    expect(unlocked.rootKey.isEqual(source.rootKey)).toBe(true);
    expect(unlocked.identityKeyPair.toPrimitives()).toEqual(
      source.identityKeyPair.toPrimitives(),
    );
    expect(unlocked.deviceCredentialKeyPair.toPrimitives()).toEqual(
      source.deviceCredentialKeyPair.toPrimitives(),
    );
    expect(unlocked.recoveryAuthorityKeyPair.toPrimitives()).toEqual(
      source.recoveryAuthorityKeyPair.toPrimitives(),
    );
  });

  it('cannot unlock a copied envelope with a different device factor', async () => {
    const protector = new DeviceIdentityProtector();
    const source = await material();
    const protectedIdentity = await protector.protect({
      deviceId: DeviceId.generate(),
      identityId: IdentityId.fromString(
        source.identityKeyPair.toPrimitives().publicKey,
      ),
      material: source,
      password: 'password',
      secretHandle: DeviceUnlockSecretHandle.generate(),
    });
    const replacement = await protector.protect({
      deviceId: protectedIdentity.deviceId,
      identityId: protectedIdentity.identityId,
      material: await material(),
      password: 'password',
      secretHandle: protectedIdentity.secretHandle,
    });

    await expect(
      protector.unlock(
        { ...protectedIdentity, factorKey: replacement.factorKey },
        'password',
      ),
    ).rejects.toThrow();
  });

  it('rewraps the local envelope without changing account key material', async () => {
    const protector = new DeviceIdentityProtector();
    const source = await material();
    const protectedIdentity = await protector.protect({
      deviceId: DeviceId.generate(),
      identityId: IdentityId.fromString(
        source.identityKeyPair.toPrimitives().publicKey,
      ),
      material: source,
      password: 'old password',
      secretHandle: DeviceUnlockSecretHandle.generate(),
    });

    const rewrapped = await protector.rewrap(
      protectedIdentity,
      'old password',
      'new password',
    );

    await expect(protector.unlock(rewrapped, 'old password')).rejects.toThrow();
    const unlocked = await protector.unlock(rewrapped, 'new password');
    expect(unlocked.rootKey.isEqual(source.rootKey)).toBe(true);
    expect(
      rewrapped.encryptedMaterial.isEqual(protectedIdentity.encryptedMaterial),
    ).toBe(true);
  });
});
