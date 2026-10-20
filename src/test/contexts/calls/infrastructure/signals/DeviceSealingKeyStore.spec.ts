import type * as BufferModule from 'buffer';

import 'fake-indexeddb/auto';
import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { randomUUID } from 'node:crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DeviceSealingKeyStore } from '../../../../../contexts/calls/infrastructure/signals/DeviceSealingKeyStore';
import { VerifierFloorStore } from '../../../../../contexts/calls/infrastructure/signals/VerifierFloorStore';
import { DeviceSealedEntryStore } from '../../../../../contexts/messages/infrastructure/mailbox/DeviceSealedEntryStore';

// The browser bundle resolves `buffer` to the npm polyfill.
jest.mock('buffer', () => jest.requireActual<typeof BufferModule>('buffer/'));

const session = (): Session =>
  ({
    deviceCredentialKeyPair: {
      toPrimitives: () => ({ publicKey: 'device-a', privateKey: 'private' }),
    },
    deviceId: 'device-1',
    deviceSealedRootKey: SymmetricKey.fromBuffer(Buffer.alloc(32, 7)),
    identity: { id: 'alice' },
  }) as unknown as Session;

describe('call sealing stores', () => {
  let name: string;

  beforeEach(() => {
    name = `call-sealing-${randomUUID()}`;
  });

  it('keeps one sealing key per device across reloads, in its own database', async () => {
    const first = await new DeviceSealingKeyStore(
      new DeviceSealedEntryStore(name, 'call sealing'),
    ).publicKey(session());
    const again = await new DeviceSealingKeyStore(
      new DeviceSealedEntryStore(name, 'call sealing'),
    ).publicKey(session());

    expect(again).toBe(first);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('opens an envelope sealed to its public key', async () => {
    const { X25519PublicKey } = await import('@haskou/pigeon-swarm-crypto');
    const { decodeBase64Url } =
      await import('../../../../../shared/infrastructure/encoding/base64url');
    const store = new DeviceSealingKeyStore(
      new DeviceSealedEntryStore(name, 'call sealing'),
    );
    const sealed = X25519PublicKey.fromRaw(
      decodeBase64Url(await store.publicKey(session())),
    ).encrypt('hello');

    expect(
      (await store.keyPair(session())).decrypt(sealed).toString('utf8'),
    ).toBe('hello');
  });

  it('keeps the verifier floor per identity and only raises it', async () => {
    const floors = new VerifierFloorStore(
      new DeviceSealedEntryStore(name, 'call sealing'),
    );

    expect(await floors.get(session(), 'bob')).toBe(0);
    await floors.raise(session(), 'bob', 4);
    await floors.raise(session(), 'bob', 2);

    expect(
      await new VerifierFloorStore(
        new DeviceSealedEntryStore(name, 'call sealing'),
      ).get(session(), 'bob'),
    ).toBe(4);
    expect(await floors.get(session(), 'carol')).toBe(0);
  });
});
