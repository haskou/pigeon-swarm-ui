import { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceIdentityKeyMaterial } from '../../../../../contexts/identities/infrastructure/crypto/DeviceIdentityKeyMaterial';
import type {
  DeviceIdentityVaultRecord,
  FirstKeychainPublishState,
} from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultSession } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVaultSession';
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

  public arm(record: DeviceIdentityVaultRecord): Promise<void> {
    const existing = this.records.get(record.identityId);

    if (existing && existing.firstKeychainPublish !== 'unacknowledged') {
      return Promise.reject(new Error('Identity vault record already exists.'));
    }

    this.records.set(record.identityId, record);

    return Promise.resolve();
  }

  public clearFirstKeychainPublish(identityId: IdentityId): Promise<void> {
    const record = this.records.get(identityId.valueOf());

    if (!record) {
      return Promise.reject(new Error('No vault record holds the marker.'));
    }

    this.records.set(identityId.valueOf(), {
      ...record,
      firstKeychainPublish: 'none',
      updatedAt: Date.now(),
    });

    return Promise.resolve();
  }

  public transitionFirstKeychainPublish(
    identityId: IdentityId,
    from: FirstKeychainPublishState,
    to: FirstKeychainPublishState,
  ): Promise<boolean> {
    const record = this.records.get(identityId.valueOf());

    if (!record) {
      return Promise.reject(new Error('No vault record holds the marker.'));
    }

    if ((record.firstKeychainPublish ?? 'none') !== from) {
      return Promise.resolve(false);
    }

    this.records.set(identityId.valueOf(), {
      ...record,
      firstKeychainPublish: to,
      updatedAt: Date.now(),
    });

    return Promise.resolve(true);
  }

  public find(
    identityId: IdentityId,
  ): Promise<DeviceIdentityVaultRecord | undefined> {
    return Promise.resolve(this.records.get(identityId.valueOf()));
  }

  public save(record: DeviceIdentityVaultRecord): Promise<void> {
    this.records.set(record.identityId, {
      ...record,
      firstKeychainPublish:
        record.firstKeychainPublish ??
        this.records.get(record.identityId)?.firstKeychainPublish,
    });

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

    this.records.set(next.identityId, {
      ...next,
      firstKeychainPublish: record.firstKeychainPublish,
    });

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

  describe('first keychain publish marker', () => {
    // Registers an identity created on this device whose genesis the node
    // has acknowledged.
    async function registerArmed(
      vault: DeviceIdentityVault,
      source: { identityId: IdentityId; material: DeviceIdentityKeyMaterial },
    ): Promise<DeviceIdentityVaultSession> {
      const session = await vault.register({
        ...source,
        firstKeychainPublish: 'unacknowledged',
        password,
      });

      await expect(
        vault.transitionFirstKeychainPublish(
          source.identityId,
          'unacknowledged',
          'armed',
        ),
      ).resolves.toBe(true);

      return session;
    }

    it('marks an identity created on this device as unacknowledged until the node accepts it', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await vault.register({
        ...source,
        firstKeychainPublish: 'unacknowledged',
        password,
      });

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('unacknowledged');
    });

    it('reports none for an identity registered without the creation flag', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await vault.register({ ...source, password });

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('none');
    });

    it('refuses to re-arm an identity whose vault record already exists', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await vault.register({ ...source, password });

      await expect(
        vault.register({
          ...source,
          firstKeychainPublish: 'unacknowledged',
          password,
        }),
      ).rejects.toThrow();

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('none');
    });

    it('registers again over a record whose identity post the node never acknowledged', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      const first = await vault.register({
        ...source,
        firstKeychainPublish: 'unacknowledged',
        password,
      });

      const second = await vault.register({
        ...source,
        firstKeychainPublish: 'unacknowledged',
        password,
      });

      expect(second.deviceId.valueOf()).not.toBe(first.deviceId.valueOf());
      await expect(store.find(source.identityId)).resolves.toMatchObject({
        deviceId: second.deviceId.valueOf(),
        firstKeychainPublish: 'unacknowledged',
      });
    });

    it.each(['armed', 'ambiguous'] as const)(
      'refuses to register again over a record the node acknowledged, marked %s',
      async (state) => {
        const store = new MemoryStore();
        const source = await fixture();
        const vault = new DeviceIdentityVault(store);
        const first = await registerArmed(vault, source);

        if (state === 'ambiguous') {
          await vault.transitionFirstKeychainPublish(
            source.identityId,
            'armed',
            'ambiguous',
          );
        }

        await expect(
          vault.register({
            ...source,
            firstKeychainPublish: 'unacknowledged',
            password,
          }),
        ).rejects.toThrow();

        await expect(store.find(source.identityId)).resolves.toMatchObject({
          deviceId: first.deviceId.valueOf(),
          firstKeychainPublish: state,
        });
      },
    );

    it('keeps the marker through a password change', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await registerArmed(vault, source);

      await vault.changePassword(source.identityId, password, nextPassword);

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('armed');
    });

    it('keeps an ambiguous marker through a password change', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await registerArmed(vault, source);
      await vault.transitionFirstKeychainPublish(
        source.identityId,
        'armed',
        'ambiguous',
      );

      await vault.changePassword(source.identityId, password, nextPassword);

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('ambiguous');
    });

    it('clears the marker once the first keychain publish is accepted', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await registerArmed(vault, source);

      await vault.clearFirstKeychainPublish(source.identityId);

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('none');
    });

    it('keeps an armed marker when the identity is registered again without the creation flag', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await registerArmed(vault, source);

      await vault.register({ ...source, password });

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('armed');
    });

    it('keeps an ambiguous marker when the identity is registered again without the creation flag', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      await registerArmed(vault, source);
      await vault.transitionFirstKeychainPublish(
        source.identityId,
        'armed',
        'ambiguous',
      );

      await vault.register({ ...source, password });

      await expect(
        vault.firstKeychainPublishState(source.identityId),
      ).resolves.toBe('ambiguous');
    });

    it('writes no marker for a registration that omits the creation flag', async () => {
      const store = new MemoryStore();
      const source = await fixture();
      const vault = new DeviceIdentityVault(store);
      const save = jest.spyOn(store, 'save');
      const clear = jest.spyOn(store, 'clearFirstKeychainPublish');
      const transition = jest.spyOn(store, 'transitionFirstKeychainPublish');

      await vault.register({ ...source, password });

      expect(clear).not.toHaveBeenCalled();
      expect(transition).not.toHaveBeenCalled();
      expect(save.mock.calls[0][0].firstKeychainPublish).toBeUndefined();
    });
  });
});
