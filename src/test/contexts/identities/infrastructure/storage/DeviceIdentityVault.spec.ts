import { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceIdentityVaultRecord } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultStore';

import { IdentityPasswordSymbolRequiredError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordSymbolRequiredError';
import { IdentityPasswordTooShortError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordTooShortError';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import { DeviceUnlockNotConfirmedError } from '../../../../../contexts/identities/infrastructure/storage/DeviceUnlockNotConfirmedError';

class MemoryStore implements DeviceIdentityVaultStore {
  public readonly records = new Map<string, DeviceIdentityVaultRecord>();

  public advanceAuthorization(
    identityId: IdentityId,
    previousRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
  ): Promise<void> {
    return this.synchronizeAuthorization(
      identityId,
      previousRevision,
      epoch,
      DeviceAuthorizationRevision.fromNumber(previousRevision.valueOf() + 1),
    );
  }

  public synchronizeAuthorization(
    identityId: IdentityId,
    localRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
    revision: DeviceAuthorizationRevision,
  ): Promise<void> {
    const record = this.records.get(identityId.valueOf());

    if (
      record?.authorizationRevision !== localRevision.valueOf() ||
      revision.valueOf() < localRevision.valueOf() ||
      (revision.isEqual(localRevision) &&
        record.authorizationEpoch !== epoch.valueOf())
    ) {
      return Promise.reject(
        new Error('Local authorization checkpoint changed.'),
      );
    }

    this.records.set(identityId.valueOf(), {
      ...record,
      authorizationEpoch: epoch.valueOf(),
      authorizationRevision: revision.valueOf(),
      updatedAt: Date.now(),
    });

    return Promise.resolve();
  }

  public delete(identityId: IdentityId): Promise<void> {
    this.records.delete(identityId.valueOf());

    return Promise.resolve();
  }

  public find(
    identityId: IdentityId,
  ): Promise<DeviceIdentityVaultRecord | undefined> {
    return Promise.resolve(this.records.get(identityId.valueOf()));
  }

  public save(record: DeviceIdentityVaultRecord): Promise<void> {
    this.records.set(record.identityId, record);

    return Promise.resolve();
  }

  public replaceProtection(
    expected: DeviceIdentityVaultRecord,
    next: DeviceIdentityVaultRecord,
  ): Promise<void> {
    const record = this.records.get(expected.identityId);

    if (
      record?.authorizationEpoch !== expected.authorizationEpoch ||
      record.authorizationRevision !== expected.authorizationRevision
    ) {
      return Promise.reject(
        new Error('Local authorization checkpoint changed.'),
      );
    }

    this.records.set(next.identityId, next);

    return Promise.resolve();
  }
}

describe(DeviceIdentityVault.name, () => {
  const password = 'Correct-Horse-Battery-Staple-9';
  const nextPassword = 'Paper-Lantern-Over-Rivers-4';

  async function fixture() {
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );

    return {
      identityId,
      material: {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identityKeyPair,
        recoveryAuthorityKeyPair: await KeyPair.generate(),
        rootKey: UserRootKey.generate(),
      },
    };
  }

  it('unlocks the same device after constructing a new vault instance', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const registered = await new DeviceIdentityVault(store).register({
      ...source,
      password,
    });

    const restored = await new DeviceIdentityVault(store).unlock(
      source.identityId,
      password,
    );

    expect(restored.authorizationEpoch.valueOf()).toBe('genesis');
    expect(restored.authorizationRevision.valueOf()).toBe(0);
    expect(restored.deviceId.isEqual(registered.deviceId)).toBe(true);
    expect(restored.material.rootKey.isEqual(source.material.rootKey)).toBe(
      true,
    );
  });

  it('does not roll back a concurrent checkpoint advance while changing the password', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });
    const find = store.find.bind(store);
    store.find = async (identityId) => {
      const record = await find(identityId);

      await store.synchronizeAuthorization(
        identityId,
        DeviceAuthorizationRevision.initial(),
        DeviceAuthorizationEpoch.genesis(),
        DeviceAuthorizationRevision.fromNumber(3),
      );

      return record;
    };

    await expect(
      vault.changePassword(source.identityId, password, nextPassword),
    ).rejects.toThrow('Local authorization checkpoint changed.');
    expect(
      store.records.get(source.identityId.valueOf())?.authorizationRevision,
    ).toBe(3);
  });

  it('changes only the local envelope during an offline password change', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });
    const before = store.records.get(source.identityId.valueOf());

    await vault.changePassword(source.identityId, password, nextPassword);

    await expect(vault.unlock(source.identityId, password)).rejects.toThrow();
    const restored = await vault.unlock(source.identityId, nextPassword);
    const after = store.records.get(source.identityId.valueOf());
    expect(restored.material.rootKey.isEqual(source.material.rootKey)).toBe(
      true,
    );
    expect(after?.encryptedMaterial).toBe(before?.encryptedMaterial);
    expect(after?.authorizationEpoch).toBe(before?.authorizationEpoch);
    expect(after?.authorizationRevision).toBe(before?.authorizationRevision);
    expect(after?.envelope).not.toBe(before?.envelope);
  });

  it('refuses to protect a new device with a password below the policy', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);

    await expect(
      vault.register({ ...source, password: 'Short-Pass-9' }),
    ).rejects.toBeInstanceOf(IdentityPasswordTooShortError);
    await expect(
      vault.register({ ...source, password: 'NoSymbolsAtAllButLong12' }),
    ).rejects.toBeInstanceOf(IdentityPasswordSymbolRequiredError);
    expect(store.records.size).toBe(0);
  });

  it('keeps the current password when the next one is below the policy', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });
    const before = store.records.get(source.identityId.valueOf());

    await expect(
      vault.changePassword(source.identityId, password, 'Short-Pass-9'),
    ).rejects.toBeInstanceOf(IdentityPasswordTooShortError);
    expect(store.records.get(source.identityId.valueOf())).toBe(before);
  });

  it('confirms the current password without changing this device', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });
    const before = store.records.get(source.identityId.valueOf());

    await expect(
      vault.confirmUnlock(source.identityId, password),
    ).resolves.toBeUndefined();
    await expect(
      vault.confirmUnlock(source.identityId, nextPassword),
    ).rejects.toBeInstanceOf(DeviceUnlockNotConfirmedError);
    expect(store.records.get(source.identityId.valueOf())).toBe(before);
  });

  it('persists an authorization checkpoint across vault instances', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });
    const epoch = DeviceAuthorizationEpoch.fromString(
      '018fe2f4-a872-49ce-8dba-bcac3b2e4187',
    );

    await vault.advanceAuthorization(
      source.identityId,
      DeviceAuthorizationRevision.initial(),
      epoch,
    );

    const restored = await new DeviceIdentityVault(store).unlock(
      source.identityId,
      password,
    );
    expect(restored.authorizationEpoch.isEqual(epoch)).toBe(true);
    expect(restored.authorizationRevision.valueOf()).toBe(1);
  });

  it('rejects a stale authorization checkpoint update', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });

    await expect(
      vault.advanceAuthorization(
        source.identityId,
        DeviceAuthorizationRevision.fromNumber(1),
        DeviceAuthorizationEpoch.genesis(),
      ),
    ).rejects.toThrow('authorization checkpoint');
  });

  it('registers recovered material at the supplied authorization checkpoint', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const epoch = DeviceAuthorizationEpoch.fromString(
      '018fe2f4-a872-49ce-8dba-bcac3b2e4187',
    );
    const revision = DeviceAuthorizationRevision.fromNumber(7);
    const vault = new DeviceIdentityVault(store);

    await vault.register({
      ...source,
      authorizationEpoch: epoch,
      authorizationRevision: revision,
      password,
    });

    const restored = await vault.unlock(source.identityId, password);
    expect(restored.authorizationEpoch.isEqual(epoch)).toBe(true);
    expect(restored.authorizationRevision.isEqual(revision)).toBe(true);
  });

  it('synchronizes an authorized device across unseen revisions', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password });

    await vault.synchronizeAuthorization(
      source.identityId,
      DeviceAuthorizationRevision.initial(),
      DeviceAuthorizationEpoch.genesis(),
      DeviceAuthorizationRevision.fromNumber(4),
    );

    const restored = await vault.unlock(source.identityId, password);
    expect(restored.authorizationRevision.valueOf()).toBe(4);
  });
});
