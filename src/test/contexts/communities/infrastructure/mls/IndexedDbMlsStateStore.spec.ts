import 'fake-indexeddb/auto';

import type { PrivateKeyPackage } from 'ts-mls';

import { IndexedDbMlsStateStore } from '../../../../../contexts/communities/infrastructure/mls/IndexedDbMlsStateStore';

const privatePackage = {
  hpkePrivateKey: new Uint8Array([1]),
  initPrivateKey: new Uint8Array([2]),
  signaturePrivateKey: new Uint8Array([3]),
} as PrivateKeyPackage;

describe('IndexedDbMlsStateStore', () => {
  it('keeps group state and key packages across store instances', async () => {
    const first = new IndexedDbMlsStateStore('mls-a', 'alice');

    await first.saveGroup('g', new Uint8Array([9, 8]));
    await first.saveKeyPackage({
      id: 'kp',
      privatePackage,
      publicBytes: new Uint8Array([7]),
    });
    const second = new IndexedDbMlsStateStore('mls-a', 'alice');

    await expect(second.loadGroup('g')).resolves.toEqual(
      new Uint8Array([9, 8]),
    );
    await expect(second.loadKeyPackages()).resolves.toEqual([
      { id: 'kp', privatePackage, publicBytes: new Uint8Array([7]) },
    ]);
    await second.deleteKeyPackage('kp');
    await expect(second.loadKeyPackages()).resolves.toEqual([]);
  });

  it('never shows one identity the state of another', async () => {
    const alice = new IndexedDbMlsStateStore('mls-b', 'alice');
    const bob = new IndexedDbMlsStateStore('mls-b', 'bob');

    await alice.saveGroup('g', new Uint8Array([1]));
    await alice.savePlaintext('g', 'c', 'secret');

    await expect(bob.loadGroup('g')).resolves.toBeUndefined();
    await expect(bob.loadPlaintext('g', 'c')).resolves.toBeUndefined();
    await expect(bob.loadKeyPackages()).resolves.toEqual([]);
    await expect(alice.loadPlaintext('g', 'c')).resolves.toBe('secret');
  });
});
