import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { MailboxKeys } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxChannel } from '../../../../../contexts/mailboxes/infrastructure/MailboxChannel';

import { MailboxCapability } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCapability';
import { MailboxReadToken } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxReadToken';
import { DirectMessageReaderSet } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageReaderSet';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

type SessionWithRoot = Session & { deviceSealedRootKey?: SymmetricKey };

const MAILBOX = 'mailbox-1';
const MASTER = Buffer.alloc(32, 1);
const SEALED = Buffer.alloc(32, 2);
const keys = { mailboxId: MAILBOX } as unknown as MailboxKeys;

const hash = (token: string): string => MailboxCapability.hash(token);
const legacyRoot = MailboxReadToken.derive(MASTER, MAILBOX);
const sealedRoot = MailboxReadToken.derive(SEALED, MAILBOX);
const legacyDevice = (credential: string): string =>
  MailboxReadToken.deriveDevice(MASTER, MAILBOX, credential);
const sealedDevice = (credential: string): string =>
  MailboxReadToken.deriveDevice(SEALED, MAILBOX, credential);

const legacySession = (): SessionWithRoot =>
  ({
    identity: { id: 'identity-1' },
    masterKey: SymmetricKey.fromBuffer(MASTER),
  }) as unknown as SessionWithRoot;

const sealedSession = (): SessionWithRoot =>
  ({
    deviceSealedRootKey: SymmetricKey.fromBuffer(SEALED),
    identity: { id: 'identity-1' },
    masterKey: SymmetricKey.fromBuffer(MASTER),
  }) as unknown as SessionWithRoot;

const sealedReaders = (credential = 'device-a') => ({
  device: sealedDevice(credential),
  root: sealedRoot,
});

const legacyReaders = (credential = 'device-a') => ({
  device: legacyDevice(credential),
  root: legacyRoot,
});

/**
 * In-memory node: a call is refused unless its root token is a registered
 * reader, the way the node authorises root-managed routes.
 */
const setup = (credentials: string[] = ['device-a', 'device-b']) => {
  const registered = new Set<string>([
    hash(legacyRoot),
    ...credentials.map((credential) => hash(legacyDevice(credential))),
  ]);
  const channel = mock<MailboxChannel>();
  const requireReader = (token: string): void => {
    if (!registered.has(hash(token))) {
      throw new HttpJsonError(401, 'Unauthorized', '');
    }
  };

  channel.listReaders.mockImplementation((_keys, token) => {
    requireReader(token);

    return Promise.resolve({
      maxReaders: 128,
      readers: Array.from(registered, (readTokenHash) => ({
        ackedCursor: 0,
        readTokenHash,
      })),
    });
  });
  channel.addReader.mockImplementation((_keys, rootToken, readerToken) => {
    requireReader(rootToken);
    registered.add(hash(readerToken));

    return Promise.resolve();
  });
  channel.removeReader.mockImplementation((_keys, rootToken, readerHash) => {
    requireReader(rootToken);
    registered.delete(readerHash);

    return Promise.resolve();
  });

  const set = new DirectMessageReaderSet(channel, () =>
    Promise.resolve([...credentials]),
  );

  return { channel, credentials, registered, set };
};

describe('DirectMessageReaderSet sealed root rotation', () => {
  it('enrols the sealed root through the legacy root, then the sealed device reader', async () => {
    const { registered, set } = setup();

    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a'));

    expect(registered.has(hash(sealedRoot))).toBe(true);
    expect(registered.has(hash(sealedDevice('device-a')))).toBe(true);
  });

  it('keeps the legacy root and legacy device readers until every credential has a sealed device reader', async () => {
    const { registered, set } = setup();

    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a'));
    await set.reconcile(sealedSession(), keys, sealedReaders('device-a'));

    expect(registered.has(hash(legacyRoot))).toBe(true);
    expect(registered.has(hash(legacyDevice('device-a')))).toBe(true);
    expect(registered.has(hash(legacyDevice('device-b')))).toBe(true);
  });

  it('removes the legacy root and legacy device readers once every credential has a sealed device reader', async () => {
    const { channel, registered, set } = setup();

    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a'));
    await channel.addReader(keys, sealedRoot, sealedDevice('device-b'));
    await set.reconcile(sealedSession(), keys, sealedReaders('device-a'));

    expect([...registered].sort()).toEqual(
      [
        hash(sealedRoot),
        hash(sealedDevice('device-a')),
        hash(sealedDevice('device-b')),
      ].sort(),
    );
  });

  it('does not let a revoked credential block removal of the legacy readers', async () => {
    const { credentials, registered, set } = setup();

    credentials.splice(1);

    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a'));
    await set.reconcile(sealedSession(), keys, sealedReaders('device-a'));

    expect([...registered].sort()).toEqual(
      [hash(sealedRoot), hash(sealedDevice('device-a'))].sort(),
    );
  });

  it('fails the enrolment when neither the legacy nor the sealed root is registered', async () => {
    const { registered, set } = setup();

    registered.delete(hash(legacyRoot));

    await expect(
      set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a')),
    ).rejects.toThrow(HttpJsonError);
  });

  it('keeps the legacy root when the prune runs under the legacy token', async () => {
    const { registered, set } = setup();

    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-a'));
    await set.enrolSealedRoot(sealedSession(), keys, sealedReaders('device-b'));

    await set.pruneUnderLegacy(
      sealedSession(),
      keys,
      sealedReaders('device-a'),
      legacyRoot,
    );

    expect(registered.has(hash(legacyRoot))).toBe(true);
  });

  it('leaves every reader alone under a masterKey-only session', async () => {
    const { channel, registered, set } = setup();

    registered.add(hash('stale-token'));

    await set.reconcile(legacySession(), keys, legacyReaders('device-a'));

    expect(channel.listReaders).not.toHaveBeenCalled();
    expect(registered.has(hash('stale-token'))).toBe(true);
    expect(registered.has(hash(legacyRoot))).toBe(true);
    expect(registered.has(hash(legacyDevice('device-b')))).toBe(true);
  });

  it('keeps a bridged sealed reader under a masterKey-only pruneUnderLegacy', async () => {
    const { registered, set } = setup();

    registered.add(hash(sealedDevice('device-b')));

    await set.pruneUnderLegacy(
      legacySession(),
      keys,
      legacyReaders('device-a'),
      legacyRoot,
    );

    expect(registered.has(hash(sealedDevice('device-b')))).toBe(true);
  });

  it('keeps the sealed root reader when a refused bridge prunes under the legacy root', async () => {
    const { registered, set } = setup();

    registered.add(hash(sealedRoot));

    await set.reconcile(sealedSession(), keys, legacyReaders('device-a'));

    expect(registered.has(hash(sealedRoot))).toBe(true);
  });

  it('skips the prune for a masterKey-only session until a sealed root is opened', async () => {
    const { channel, registered, set } = setup();

    registered.add(hash(sealedRoot));
    registered.add(hash(sealedDevice('device-a')));

    await set.reconcile(legacySession(), keys, legacyReaders('device-a'));
    expect(channel.listReaders).not.toHaveBeenCalled();

    await set.reconcile(sealedSession(), keys, sealedReaders('device-a'));
    expect(channel.listReaders).toHaveBeenCalledTimes(1);
  });
});
