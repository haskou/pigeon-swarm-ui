import { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceIdentityVaultRecord } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultStore';

import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';

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
}

describe(DeviceIdentityVault.name, () => {
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
      password: 'password',
    });

    const restored = await new DeviceIdentityVault(store).unlock(
      source.identityId,
      'password',
    );

    expect(restored.authorizationEpoch.valueOf()).toBe('genesis');
    expect(restored.authorizationRevision.valueOf()).toBe(0);
    expect(restored.deviceId.isEqual(registered.deviceId)).toBe(true);
    expect(restored.material.rootKey.isEqual(source.material.rootKey)).toBe(
      true,
    );
  });

  it('changes only the local envelope during an offline password change', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password: 'old password' });
    const before = store.records.get(source.identityId.valueOf());

    await vault.changePassword(
      source.identityId,
      'old password',
      'new password',
    );

    await expect(
      vault.unlock(source.identityId, 'old password'),
    ).rejects.toThrow();
    const restored = await vault.unlock(source.identityId, 'new password');
    const after = store.records.get(source.identityId.valueOf());
    expect(restored.material.rootKey.isEqual(source.material.rootKey)).toBe(
      true,
    );
    expect(after?.encryptedMaterial).toBe(before?.encryptedMaterial);
    expect(after?.authorizationEpoch).toBe(before?.authorizationEpoch);
    expect(after?.authorizationRevision).toBe(before?.authorizationRevision);
    expect(after?.envelope).not.toBe(before?.envelope);
  });

  it('persists an authorization checkpoint across vault instances', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password: 'password' });
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
      'password',
    );
    expect(restored.authorizationEpoch.isEqual(epoch)).toBe(true);
    expect(restored.authorizationRevision.valueOf()).toBe(1);
  });

  it('rejects a stale authorization checkpoint update', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password: 'password' });

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
      password: 'password',
    });

    const restored = await vault.unlock(source.identityId, 'password');
    expect(restored.authorizationEpoch.isEqual(epoch)).toBe(true);
    expect(restored.authorizationRevision.isEqual(revision)).toBe(true);
  });

  it('synchronizes an authorized device across unseen revisions', async () => {
    const store = new MemoryStore();
    const source = await fixture();
    const vault = new DeviceIdentityVault(store);
    await vault.register({ ...source, password: 'password' });

    await vault.synchronizeAuthorization(
      source.identityId,
      DeviceAuthorizationRevision.initial(),
      DeviceAuthorizationEpoch.genesis(),
      DeviceAuthorizationRevision.fromNumber(4),
    );

    const restored = await vault.unlock(source.identityId, 'password');
    expect(restored.authorizationRevision.valueOf()).toBe(4);
  });
});
