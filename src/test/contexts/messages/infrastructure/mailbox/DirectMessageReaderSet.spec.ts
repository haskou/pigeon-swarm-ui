import type { MailboxInboxKeys } from '@haskou/pigeon-swarm-crypto';

import {
  BearerCapability,
  MailboxReadToken,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Buffer } from 'buffer';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';

import { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

/** A mailbox id is the canonical base64url of 32 bytes. */
const MAILBOX = 'CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk';
const IDENTITY_ROOT = SymmetricKey.fromBuffer(Buffer.alloc(32, 1));
const SEALED = SymmetricKey.fromBuffer(Buffer.alloc(32, 2));
const keys = { mailboxId: MAILBOX } as unknown as MailboxInboxKeys;

const hash = (token: string): string => BearerCapability.hash(token);
const sealedRoot = MailboxReadToken.derive(SEALED, MAILBOX);
const sealedDevice = (credential: string): string =>
  MailboxReadToken.deriveDevice(SEALED, MAILBOX, credential);
const identityRootReader = MailboxReadToken.derive(IDENTITY_ROOT, MAILBOX);
const identityRootDevice = (credential: string): string =>
  MailboxReadToken.deriveDevice(IDENTITY_ROOT, MAILBOX, credential);

const session = (): Session =>
  ({
    deviceSealedRootKey: SEALED,
    identity: { id: 'identity-1' },
    masterKey: IDENTITY_ROOT,
  }) as unknown as Session;

const readers = (credential = 'device-a') => ({
  device: sealedDevice(credential),
  root: sealedRoot,
});

/** The sealed root a revoke rotated in, replacing SEALED. */
const ROTATED = SymmetricKey.fromBuffer(Buffer.alloc(32, 3));
const rotatedSession = (): Session =>
  ({
    ...session(),
    deviceSealedRootKey: ROTATED,
    previousDeviceSealedRootKey: SEALED,
  }) as unknown as Session;
const rotatedReaders = (credential = 'device-a') => ({
  device: MailboxReadToken.deriveDevice(ROTATED, MAILBOX, credential),
  root: MailboxReadToken.derive(ROTATED, MAILBOX),
});

/**
 * In-memory node holding an inbox created under the sealed root: a call is
 * refused unless its root token is a registered reader, the way the node
 * authorises root-managed routes.
 */
const setup = (credentials: string[] = ['device-a', 'device-b']) => {
  const registered = new Set<string>([hash(sealedRoot)]);
  const channel = mock<MailboxChannel>();
  const requireReader = (token: string): void => {
    if (!registered.has(hash(token))) {
      throw new HttpJsonError(401, 'Unauthorized', '');
    }
  };

  // A node call rejects; it never throws synchronously.
  channel.listReaders.mockImplementation((_keys, token) =>
    Promise.resolve().then(() => {
      requireReader(token);

      return {
        maxReaders: 128,
        readers: Array.from(registered, (readTokenHash) => ({
          ackedCursor: 0,
          readTokenHash,
        })),
      };
    }),
  );
  channel.addReader.mockImplementation((_keys, rootToken, readerToken) =>
    Promise.resolve().then(() => {
      requireReader(rootToken);
      registered.add(hash(readerToken));
    }),
  );
  channel.removeReader.mockImplementation((_keys, rootToken, readerHash) =>
    Promise.resolve().then(() => {
      requireReader(rootToken);
      registered.delete(readerHash);
    }),
  );

  const set = new DirectMessageReaderSet(channel, () =>
    Promise.resolve([...credentials]),
  );

  return { channel, registered, set };
};

describe(DirectMessageReaderSet.name, () => {
  it("enrols this device's reader under the root reader only", async () => {
    const { channel, registered, set } = setup();

    await set.enrolSealedRoot(session(), keys, readers('device-a'));

    expect(channel.addReader.mock.calls).toEqual([
      [keys, sealedRoot, sealedDevice('device-a')],
    ]);
    expect(registered.has(hash(sealedDevice('device-a')))).toBe(true);
  });

  it('fails the enrolment when the root reader is not registered', async () => {
    const { registered, set } = setup();

    registered.clear();

    await expect(
      set.enrolSealedRoot(session(), keys, readers('device-a')),
    ).rejects.toThrow(HttpJsonError);
  });

  it('removes readers no current device holds, identity-root readers included', async () => {
    const { registered, set } = setup();

    registered.add(hash(identityRootReader));
    registered.add(hash(identityRootDevice('device-a')));
    registered.add(hash(identityRootDevice('device-b')));
    registered.add(hash('stale-reader-capability-token'));

    await set.enrolSealedRoot(session(), keys, readers('device-a'));
    await set.reconcile(session(), keys, readers('device-a'));

    expect([...registered].sort()).toEqual(
      [hash(sealedRoot), hash(sealedDevice('device-a'))].sort(),
    );
  });

  it("keeps every current device's reader", async () => {
    const { registered, set } = setup();

    registered.add(hash(sealedDevice('device-b')));

    await set.enrolSealedRoot(session(), keys, readers('device-a'));
    await set.reconcile(session(), keys, readers('device-a'));

    expect([...registered].sort()).toEqual(
      [
        hash(sealedRoot),
        hash(sealedDevice('device-a')),
        hash(sealedDevice('device-b')),
      ].sort(),
    );
  });

  it("keeps the root and this device's reader while the credential list lags", async () => {
    const { registered, set } = setup([]);

    await set.enrolSealedRoot(session(), keys, readers('device-a'));
    await set.reconcile(session(), keys, readers('device-a'));

    expect([...registered].sort()).toEqual(
      [hash(sealedRoot), hash(sealedDevice('device-a'))].sort(),
    );
  });

  it('never rejects a failed prune and retries it on the next sync', async () => {
    const { channel, set } = setup();
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

    channel.listReaders.mockRejectedValueOnce(new Error('node down'));

    await expect(
      set.reconcile(session(), keys, readers('device-a')),
    ).resolves.toBeUndefined();
    await set.reconcile(session(), keys, readers('device-a'));

    expect(channel.listReaders).toHaveBeenCalledTimes(2);
    debug.mockRestore();
  });

  describe('cutOff', () => {
    it("leaves only the rotated root and the remaining devices' readers once it resolves", async () => {
      const { registered, set } = setup(['device-a']);

      registered.add(hash(sealedDevice('device-a')));
      registered.add(hash(sealedDevice('device-b')));

      await set.cutOff(rotatedSession(), keys, rotatedReaders('device-a'));

      expect([...registered].sort()).toEqual(
        [
          hash(rotatedReaders('device-a').root),
          hash(rotatedReaders('device-a').device),
        ].sort(),
      );
    });

    it('rejects when the reconcile it joins fails, and prunes on the next call', async () => {
      const { channel, registered, set } = setup(['device-a']);
      const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
      let failListing: (error: Error) => void = () => undefined;

      registered.add(hash(sealedDevice('device-b')));
      channel.listReaders.mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          failListing = reject;
        }),
      );
      await set.enrolSealedRoot(
        rotatedSession(),
        keys,
        rotatedReaders('device-a'),
      );
      // The revoke's session update starts the reconcile; the cut-off joins it.
      const reconciling = set.reconcile(
        rotatedSession(),
        keys,
        rotatedReaders('device-a'),
      );
      const cutting = set.cutOff(
        rotatedSession(),
        keys,
        rotatedReaders('device-a'),
      );
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      failListing(new Error('node down'));

      await expect(cutting).rejects.toThrow('node down');
      await expect(reconciling).resolves.toBeUndefined();
      expect(channel.listReaders).toHaveBeenCalledTimes(1);
      expect(registered.has(hash(sealedDevice('device-b')))).toBe(true);

      await set.cutOff(rotatedSession(), keys, rotatedReaders('device-a'));

      expect(registered.has(hash(sealedDevice('device-b')))).toBe(false);
      debug.mockRestore();
    });

    it('rejects when a revoked reader cannot be removed', async () => {
      const { channel, registered, set } = setup(['device-a']);

      registered.add(hash(sealedDevice('device-b')));
      channel.removeReader.mockRejectedValue(
        new HttpJsonError(503, 'Service Unavailable', ''),
      );

      await expect(
        set.cutOff(rotatedSession(), keys, rotatedReaders('device-a')),
      ).rejects.toThrow(HttpJsonError);
      expect(registered.has(hash(sealedDevice('device-b')))).toBe(true);
    });
  });
});
