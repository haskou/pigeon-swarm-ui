import { EncryptedPayload, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceSealedRecovery } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRecovery';
import { DeviceSealedRecoveryStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceSealedRecoveryStore';

const identityId = 'identity-1';
const head = {
  keychain: { conversations: {}, version: 1 } as LocalKeychain,
  keychainExternalIdentifier: 'kc-1',
};

function memoryStorage(): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

describe(DeviceSealedRecovery.name, () => {
  const masterKey = SymmetricKey.generate();
  const previousRoot = SymmetricKey.generate();
  const currentRoot = SymmetricKey.generate();
  const sessionAt = (revision: number, extra: Partial<Session> = {}): Session =>
    ({
      authorizationRevision: DeviceAuthorizationRevision.fromNumber(revision),
      identity: { id: identityId },
      masterKey,
      ...extra,
    }) as unknown as Session;

  function harness(): {
    deviceSealedRoot: jest.Mocked<DeviceSealedRootRotation>;
    keychains: jest.Mocked<PigeonKeychainApi>;
    recovery: DeviceSealedRecovery;
    store: DeviceSealedRecoveryStore;
  } {
    const deviceSealedRoot = mock<DeviceSealedRootRotation>();
    const keychains = mock<PigeonKeychainApi>();
    const store = new DeviceSealedRecoveryStore(memoryStorage());

    return {
      deviceSealedRoot,
      keychains,
      recovery: new DeviceSealedRecovery(deviceSealedRoot, keychains, store),
      store,
    };
  }

  describe('rememberKeychainRewrap', () => {
    it('seals the previous root under the master key before a revoke moves the root', () => {
      const { recovery, store } = harness();

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );

      const sealed = store.read(identityId).keychainRewrap;

      expect(sealed).toBeDefined();
      expect(
        masterKey.decrypt(new EncryptedPayload(sealed as string)).toString(),
      ).toBe(previousRoot.toString());
      expect(() =>
        currentRoot.decrypt(new EncryptedPayload(sealed as string)),
      ).toThrow();
    });

    it('records the master key when the head is still sealed under it', () => {
      const { recovery, store } = harness();

      recovery.rememberKeychainRewrap(sessionAt(1));

      expect(
        masterKey
          .decrypt(
            new EncryptedPayload(
              store.read(identityId).keychainRewrap as string,
            ),
          )
          .toString(),
      ).toBe(masterKey.toString());
    });
  });

  describe('rewrapAfterRevoke', () => {
    it('clears the record once the rewrap under the new root lands', async () => {
      const { keychains, recovery, store } = harness();
      const rotated = sessionAt(2, { deviceSealedRootKey: currentRoot });

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );
      keychains.rewrapHead.mockResolvedValue(undefined);

      await recovery.rewrapAfterRevoke(rotated, head);

      expect(keychains.rewrapHead).toHaveBeenCalledWith(rotated, head);
      expect(store.read(identityId).keychainRewrap).toBeUndefined();
    });

    it('keeps the previous root for the next unlock and does not throw when the rewrap fails', async () => {
      const { keychains, recovery, store } = harness();

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );
      keychains.rewrapHead.mockRejectedValue(new Error('network down'));

      await expect(
        recovery.rewrapAfterRevoke(
          sessionAt(2, { deviceSealedRootKey: currentRoot }),
          head,
        ),
      ).resolves.toBeUndefined();
      expect(store.read(identityId).keychainRewrap).toBeDefined();
    });
  });

  describe('resumeKeychainRewrap', () => {
    it('reseals the head under the current root with the recorded previous root, then clears the record', async () => {
      const { keychains, recovery, store } = harness();
      const rooted = sessionAt(2, { deviceSealedRootKey: currentRoot });

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );
      keychains.rewrapHeadSealedUnder.mockResolvedValue(undefined);

      await recovery.resumeKeychainRewrap(rooted);

      expect(keychains.rewrapHeadSealedUnder).toHaveBeenCalledWith(
        rooted,
        previousRoot,
      );
      expect(store.read(identityId).keychainRewrap).toBeUndefined();
    });

    it('keeps the record when the head cannot be opened under the recorded root', async () => {
      const { keychains, recovery, store } = harness();

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );
      keychains.rewrapHeadSealedUnder.mockRejectedValue(new Error('409'));

      await expect(
        recovery.resumeKeychainRewrap(
          sessionAt(2, { deviceSealedRootKey: currentRoot }),
        ),
      ).resolves.toBeUndefined();
      expect(store.read(identityId).keychainRewrap).toBeDefined();
    });

    it('waits while the session holds no root', async () => {
      const { keychains, recovery, store } = harness();

      recovery.rememberKeychainRewrap(
        sessionAt(1, { deviceSealedRootKey: previousRoot }),
      );

      await recovery.resumeKeychainRewrap(sessionAt(2));

      expect(keychains.rewrapHeadSealedUnder).not.toHaveBeenCalled();
      expect(store.read(identityId).keychainRewrap).toBeDefined();
    });

    it('does nothing without a record', async () => {
      const { keychains, recovery } = harness();

      await recovery.resumeKeychainRewrap(
        sessionAt(2, { deviceSealedRootKey: currentRoot }),
      );

      expect(keychains.rewrapHeadSealedUnder).not.toHaveBeenCalled();
    });
  });

  describe('resealAfterPairing', () => {
    it('records the root for the paired revision before the reseal, then clears it', async () => {
      const { deviceSealedRoot, recovery, store } = harness();
      const session = sessionAt(2, { deviceSealedRootKey: currentRoot });
      let pendingDuringReseal: unknown;

      deviceSealedRoot.reseal.mockImplementation(() => {
        pendingDuringReseal = store.read(identityId).rootReseal;

        return Promise.resolve();
      });

      await recovery.resealAfterPairing(session, currentRoot);

      expect(deviceSealedRoot.reseal).toHaveBeenCalledWith(
        session,
        currentRoot,
      );
      expect(pendingDuringReseal).toMatchObject({ authorizationRevision: 2 });
      expect(store.read(identityId).rootReseal).toBeUndefined();
    });

    it('keeps the record and does not throw when the reseal fails', async () => {
      const { deviceSealedRoot, recovery, store } = harness();

      deviceSealedRoot.reseal.mockRejectedValue(new Error('409'));

      await expect(
        recovery.resealAfterPairing(
          sessionAt(2, { deviceSealedRootKey: currentRoot }),
          currentRoot,
        ),
      ).resolves.toBeUndefined();
      expect(store.read(identityId).rootReseal).toMatchObject({
        authorizationRevision: 2,
      });
    });
  });

  describe('resumeRootReseal', () => {
    it('reseals the recorded root at the synchronized revision, then clears the record', async () => {
      const { deviceSealedRoot, recovery, store } = harness();

      deviceSealedRoot.reseal.mockRejectedValueOnce(new Error('offline'));
      await recovery.resealAfterPairing(
        sessionAt(2, { deviceSealedRootKey: currentRoot }),
        currentRoot,
      );
      deviceSealedRoot.reseal.mockResolvedValue(undefined);

      const synchronized = sessionAt(2);

      await recovery.resumeRootReseal(synchronized);

      expect(deviceSealedRoot.reseal).toHaveBeenLastCalledWith(
        synchronized,
        currentRoot,
      );
      expect(store.read(identityId).rootReseal).toBeUndefined();
    });

    it('drops a record for a revision the authorization has moved past', async () => {
      const { deviceSealedRoot, recovery, store } = harness();

      deviceSealedRoot.reseal.mockRejectedValueOnce(new Error('offline'));
      await recovery.resealAfterPairing(
        sessionAt(2, { deviceSealedRootKey: currentRoot }),
        currentRoot,
      );
      deviceSealedRoot.reseal.mockClear();

      await recovery.resumeRootReseal(sessionAt(3));

      expect(deviceSealedRoot.reseal).not.toHaveBeenCalled();
      expect(store.read(identityId).rootReseal).toBeUndefined();
    });

    it('keeps the record when the reseal fails again', async () => {
      const { deviceSealedRoot, recovery, store } = harness();

      deviceSealedRoot.reseal.mockRejectedValueOnce(new Error('offline'));
      await recovery.resealAfterPairing(
        sessionAt(2, { deviceSealedRootKey: currentRoot }),
        currentRoot,
      );
      deviceSealedRoot.reseal.mockRejectedValueOnce(new Error('offline'));

      await expect(recovery.resumeRootReseal(sessionAt(2))).resolves.toBe(
        undefined,
      );
      expect(store.read(identityId).rootReseal).toBeDefined();
    });
  });
});
