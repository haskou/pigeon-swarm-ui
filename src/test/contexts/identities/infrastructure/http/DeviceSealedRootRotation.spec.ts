import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceSealedSecretApi';
import type { PigeonKeychainApi } from '../../../../../contexts/identities/infrastructure/http/PigeonKeychainApi';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { RevokedDeviceSealedSecretPublisherError } from '../../../../../contexts/identities/domain/errors/RevokedDeviceSealedSecretPublisherError';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
import { DeviceSealedRootTrustStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceSealedRootTrustStore';
import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../../shared/infrastructure/encoding/base64url';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

type SessionWithRoot = Session & { deviceSealedRootKey?: SymmetricKey };

const IDENTITY_ID = '00000000-0000-4000-8000-000000000001';
const RECIPIENTS = [
  { id: 'device-a' },
  { id: 'device-b' },
] as unknown as DeviceCredential[];
const PUBLISHER = { id: 'publisher' } as unknown as DeviceCredential;
const UNAUTHORIZED = 'Device sealed secret publisher is not authorized.';
const MASTER_KEY = SymmetricKey.generate();

const makeSession = (revision: number): SessionWithRoot =>
  ({
    authorizationRevision: DeviceAuthorizationRevision.fromNumber(revision),
    identity: { id: IDENTITY_ID },
    masterKey: MASTER_KEY,
  }) as unknown as SessionWithRoot;

const memoryStorage = (): Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
> => {
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
};

const setup = (clock = 1_000) => {
  const deviceAuthorization = mock<PigeonDeviceAuthorizationApi>();
  const sealedSecrets = mock<PigeonDeviceSealedSecretApi>();
  const keychains = mock<PigeonKeychainApi>();
  const trust = new DeviceSealedRootTrustStore(memoryStorage());
  const rotation = new DeviceSealedRootRotation(
    deviceAuthorization,
    sealedSecrets,
    keychains,
    trust,
    () => clock,
  );

  deviceAuthorization.findDevices.mockResolvedValue(RECIPIENTS);
  sealedSecrets.fetchOwn.mockResolvedValue(null);
  sealedSecrets.publish.mockResolvedValue(undefined);

  return { deviceAuthorization, keychains, rotation, sealedSecrets };
};

describe('DeviceSealedRootRotation', () => {
  describe('rotate', () => {
    it('publishes a fresh 32-byte root to the head recipients and holds it on the session', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const session = makeSession(4);

      const rotated = await rotation.rotate(session);

      expect(deviceAuthorization.findDevices).toHaveBeenCalledWith(session);
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);

      const [published, input] = sealedSecrets.publish.mock.calls[0];

      expect(published).toBe(session);
      expect(input.recipients).toEqual(RECIPIENTS);
      expect(input.generation).toBe(1_001);
      expect(decodeBase64Url(input.payload)).toHaveLength(32);
      expect(
        rotated.deviceSealedRootKey
          ?.getBuffer()
          .equals(decodeBase64Url(input.payload)),
      ).toBe(true);
      expect(rotated.deviceSealedRootGeneration?.valueOf()).toBe(1_001);
    });

    it('issues a generation strictly greater than the stored one even when the clock is behind', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9_000,
        payload: 'stale',
        publisherCredential: PUBLISHER,
      });

      await rotation.rotate(makeSession(4));

      expect(sealedSecrets.publish.mock.calls[0][1].generation).toBe(9_001);
    });

    it('generates a new root on each rotation', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      await rotation.rotate(makeSession(4));
      await rotation.rotate(makeSession(4));

      const first = sealedSecrets.publish.mock.calls[0][1].payload;
      const second = sealedSecrets.publish.mock.calls[1][1].payload;

      expect(first).not.toBe(second);
    });

    it('keeps the root it replaces on the session, so the mailboxes bridge from it', async () => {
      const { rotation } = setup(1_000);
      const previous = SymmetricKey.generate();
      const session = {
        ...makeSession(4),
        deviceSealedRootKey: previous,
      } as SessionWithRoot;

      const rotated = await rotation.rotate(session);

      expect(rotated.previousDeviceSealedRootKey).toBe(previous);
      expect(rotated.deviceSealedRootKey).not.toBe(previous);
    });

    it('keeps no previous root when the session held none', async () => {
      const { rotation } = setup(1_000);

      const rotated = await rotation.rotate(makeSession(4));

      expect(rotated.previousDeviceSealedRootKey).toBeUndefined();
    });

    it('seals the root it replaces with the fresh one, to the devices left at the revoke revision only', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const previous = SymmetricKey.generate();
      const revoked = { id: 'device-revoked' } as unknown as DeviceCredential;
      const session = {
        ...makeSession(5),
        deviceSealedRootKey: previous,
      } as SessionWithRoot;

      deviceAuthorization.findDevices.mockImplementation((at) =>
        Promise.resolve(
          at.authorizationRevision.valueOf() === 5
            ? RECIPIENTS
            : [...RECIPIENTS, revoked],
        ),
      );

      const rotated = await rotation.rotate(session);
      const [, input] = sealedSecrets.publish.mock.calls[0];
      const [root, carried, ...rest] = input.payload.split('.');

      expect(input.recipients).toEqual(RECIPIENTS);
      expect(input.recipients).not.toContain(revoked);
      expect(rest).toEqual([]);
      expect(
        rotated.deviceSealedRootKey?.getBuffer().equals(decodeBase64Url(root)),
      ).toBe(true);
      expect(decodeBase64Url(carried).equals(previous.getBuffer())).toBe(true);
    });

    it('still seals the replaced root when a conflicting publish is retried', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const previous = SymmetricKey.generate();

      deviceAuthorization.synchronize.mockResolvedValue(makeSession(6));
      sealedSecrets.publish
        .mockRejectedValueOnce(new HttpJsonError(409, 'Conflict', ''))
        .mockResolvedValueOnce(undefined);

      await rotation.rotate({
        ...makeSession(5),
        deviceSealedRootKey: previous,
      } as SessionWithRoot);

      const [, carried] =
        sealedSecrets.publish.mock.calls[1][1].payload.split('.');

      expect(decodeBase64Url(carried).equals(previous.getBuffer())).toBe(true);
    });

    it('synchronizes and retries once on a conflicting publish, against the synchronized session', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const stale = makeSession(4);
      const synced = makeSession(5);

      sealedSecrets.publish
        .mockRejectedValueOnce(new HttpJsonError(409, 'Conflict', ''))
        .mockResolvedValueOnce(undefined);
      deviceAuthorization.synchronize.mockResolvedValue(synced);

      const rotated = await rotation.rotate(stale);

      expect(deviceAuthorization.synchronize).toHaveBeenCalledWith(stale);
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(2);
      expect(sealedSecrets.publish.mock.calls[1][0]).toBe(synced);
      expect(rotated.deviceSealedRootKey).toBeDefined();
    });

    it('does not retry on a non-conflict failure', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);

      sealedSecrets.publish.mockRejectedValueOnce(
        new HttpJsonError(500, 'Server Error', ''),
      );

      await expect(rotation.rotate(makeSession(4))).rejects.toThrow(
        HttpJsonError,
      );
      expect(deviceAuthorization.synchronize).not.toHaveBeenCalled();
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('reseal', () => {
    it('publishes the given root at a new generation to the head recipients', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const session = makeSession(5);
      const root = SymmetricKey.generate();

      await rotation.reseal(session, root);

      expect(deviceAuthorization.findDevices).toHaveBeenCalledWith(session);
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);

      const [published, input] = sealedSecrets.publish.mock.calls[0];

      expect(published).toBe(session);
      expect(input.recipients).toEqual(RECIPIENTS);
      expect(input.generation).toBe(1_001);
      expect(
        Buffer.from(decodeBase64Url(input.payload)).equals(root.getBuffer()),
      ).toBe(true);
    });

    it('lets a device opened on the resealed revision read the same root without publishing', async () => {
      const { rotation, sealedSecrets } = setup(1_000);
      const root = SymmetricKey.generate();

      await rotation.reseal(makeSession(5), root);
      const [, input] = sealedSecrets.publish.mock.calls[0];
      sealedSecrets.publish.mockClear();
      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 5,
        generation: input.generation,
        payload: input.payload,
        publisherCredential: PUBLISHER,
      });

      const current = await rotation.current(makeSession(5));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(
        current.deviceSealedRootKey?.getBuffer().equals(root.getBuffer()),
      ).toBe(true);
    });
  });

  describe('current', () => {
    it('opens a fresh entry without publishing', async () => {
      const { rotation, sealedSecrets } = setup();
      const root = SymmetricKey.generate().getBuffer();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 7,
        payload: encodeBase64Url(root),
        publisherCredential: PUBLISHER,
      });

      const current = await rotation.current(makeSession(4));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(current.deviceSealedRootKey?.getBuffer().equals(root)).toBe(true);
      expect(current.deviceSealedRootGeneration?.valueOf()).toBe(7);
    });

    it('keeps the previous root of the session when the entry carries none', async () => {
      const { rotation, sealedSecrets } = setup();
      const previous = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 7,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });

      const current = await rotation.current({
        ...makeSession(4),
        previousDeviceSealedRootKey: previous,
      });

      expect(current.previousDeviceSealedRootKey).toBe(previous);
    });

    it('re-syncs a stale session and opens its entry without publishing', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const root = SymmetricKey.generate();

      deviceAuthorization.synchronize.mockResolvedValue(makeSession(4));
      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 8,
        payload: encodeBase64Url(root.getBuffer()),
        publisherCredential: PUBLISHER,
      });

      const current = await rotation.current(makeSession(3));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(current.deviceSealedRootKey?.getBuffer()).toEqual(
        root.getBuffer(),
      );
      expect(current.deviceSealedRootGeneration?.valueOf()).toBe(8);
    });

    it('publishes when this device has no entry yet', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      const current = await rotation.current(makeSession(4));

      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);
      expect(current.deviceSealedRootKey).toBeDefined();
    });

    it('does not mint a root when the identity keychain head cannot be read', async () => {
      const { keychains, rotation, sealedSecrets } = setup(1_000);
      keychains.readHead.mockRejectedValue(
        new Error('head sealed under an unopenable root'),
      );

      await expect(rotation.current(makeSession(4))).rejects.toThrow(
        'head sealed under an unopenable root',
      );
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
    });

    it('never replaces a keychain head it cannot read, so a node serving a corrupt head cannot clear it', async () => {
      const { keychains, rotation } = setup(1_000);
      keychains.readHead.mockRejectedValue(new Error('corrupt head'));

      await expect(rotation.current(makeSession(4))).rejects.toThrow(
        'corrupt head',
      );
      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });

    it('never replaces a keychain head the node withholds', async () => {
      const { keychains, rotation } = setup(1_000);
      keychains.readHead.mockResolvedValue(undefined);

      await rotation.current(makeSession(4));

      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });

    it('mints the first entry when the identity keychain head is readable', async () => {
      const { keychains, rotation, sealedSecrets } = setup(1_000);
      keychains.readHead.mockResolvedValue({
        keychain: { conversations: {}, version: 1 } as LocalKeychain,
        keychainExternalIdentifier: 'kc-1',
      });

      const current = await rotation.current(makeSession(4));

      expect(keychains.readHead).toHaveBeenCalledTimes(1);
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);
      expect(current.deviceSealedRootKey).toBeDefined();
    });

    it('returns the synchronized session without a root when its entry still lags the head', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const synced = makeSession(5);

      deviceAuthorization.synchronize.mockResolvedValue(synced);
      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 8,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });

      await expect(rotation.current(makeSession(3))).resolves.toBe(synced);
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
    });

    it('opens the root of a hand-over and keeps the root it replaced, so the keychain and mailboxes move from it', async () => {
      const { rotation, sealedSecrets } = setup();
      const root = SymmetricKey.generate();
      const previous = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9,
        payload: `${encodeBase64Url(root.getBuffer())}.${encodeBase64Url(previous.getBuffer())}`,
        publisherCredential: PUBLISHER,
      });

      const current = await rotation.current(makeSession(4));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(current.deviceSealedRootKey?.getBuffer()).toEqual(
        root.getBuffer(),
      );
      expect(current.previousDeviceSealedRootKey?.getBuffer()).toEqual(
        previous.getBuffer(),
      );
    });

    it('refuses a payload carrying more than a root and the root it replaced', async () => {
      const { rotation, sealedSecrets } = setup();
      const part = encodeBase64Url(SymmetricKey.generate().getBuffer());

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9,
        payload: `${part}.${part}.${part}`,
        publisherCredential: PUBLISHER,
      });

      await expect(rotation.current(makeSession(4))).rejects.toThrow();
    });
  });

  describe('openAfterRecovery', () => {
    const credential = (fill: string): string =>
      `-----BEGIN PUBLIC KEY-----\n${fill.repeat(60)}\n-----END PUBLIC KEY-----\n`;
    const OWN = credential('A');
    const OTHER = credential('B');
    const recovered = (): SessionWithRoot =>
      ({
        ...makeSession(7),
        deviceCredentialKeyPair: {
          toPrimitives: () => ({ publicKey: OWN }),
        },
      }) as unknown as SessionWithRoot;

    it('mints a fresh root on the only device the recovery left, replacing the head no device can open before publishing the root', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockResolvedValue([
        DeviceCredential.fromString(OWN),
      ]);

      const opened = await rotation.openAfterRecovery(recovered());

      expect(keychains.readHead).not.toHaveBeenCalled();
      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);
      expect(opened.deviceSealedRootKey).toBeDefined();
      expect(opened.deviceSealedRootGeneration?.valueOf()).toBe(1_001);
      expect(keychains.replaceHeadAfterRecovery).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceSealedRootKey: opened.deviceSealedRootKey,
        }),
      );
      // A root published over a head it does not open would let a password
      // unlock reach a keychain it cannot read; a failed replacement leaves
      // nothing published, so the recovery is simply run again.
      expect(
        keychains.replaceHeadAfterRecovery.mock.invocationCallOrder[0],
      ).toBeLessThan(sealedSecrets.publish.mock.invocationCallOrder[0]);
    });

    it('seals the fresh root only to the verified device, never to a device the node lists', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const own = DeviceCredential.fromString(OWN);
      deviceAuthorization.verifiedDevices.mockResolvedValue([own]);
      deviceAuthorization.findDevices.mockResolvedValue([
        own,
        DeviceCredential.fromString(OTHER),
      ]);

      await rotation.openAfterRecovery(recovered());

      expect(deviceAuthorization.findDevices).not.toHaveBeenCalled();
      expect(sealedSecrets.publish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ recipients: [own] }),
      );
    });

    it('publishes no root when the head cannot be replaced', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockResolvedValue([
        DeviceCredential.fromString(OWN),
      ]);
      keychains.replaceHeadAfterRecovery.mockRejectedValue(new Error('409'));

      await expect(rotation.openAfterRecovery(recovered())).rejects.toThrow(
        '409',
      );
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
    });

    it('refuses while the signed transitions authorize another device, which may still open the head', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockResolvedValue([
        DeviceCredential.fromString(OWN),
        DeviceCredential.fromString(OTHER),
      ]);

      await expect(rotation.openAfterRecovery(recovered())).rejects.toThrow();
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });

    it('refuses when the only authorized device is not this one', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockResolvedValue([
        DeviceCredential.fromString(OTHER),
      ]);

      await expect(rotation.openAfterRecovery(recovered())).rejects.toThrow();
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });

    it('refuses when the served transitions do not verify', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockRejectedValue(
        new Error('unproven'),
      );

      await expect(rotation.openAfterRecovery(recovered())).rejects.toThrow(
        'unproven',
      );
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });

    it('refuses a session that already holds a root', async () => {
      const { deviceAuthorization, keychains, rotation, sealedSecrets } =
        setup(1_000);
      deviceAuthorization.verifiedDevices.mockResolvedValue([
        DeviceCredential.fromString(OWN),
      ]);

      await expect(
        rotation.openAfterRecovery({
          ...recovered(),
          deviceSealedRootKey: SymmetricKey.generate(),
        }),
      ).rejects.toThrow();
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(keychains.replaceHeadAfterRecovery).not.toHaveBeenCalled();
    });
  });

  describe('laggingRoot', () => {
    it('opens an own entry behind the session revision', async () => {
      const { rotation, sealedSecrets } = setup();
      const root = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 8,
        payload: encodeBase64Url(root.getBuffer()),
        publisherCredential: PUBLISHER,
      });

      const lagging = await rotation.laggingRoot(makeSession(5));

      expect(lagging?.getBuffer()).toEqual(root.getBuffer());
    });

    it('opens only the root of a lagging hand-over', async () => {
      const { rotation, sealedSecrets } = setup();
      const root = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 8,
        payload: `${encodeBase64Url(root.getBuffer())}.${encodeBase64Url(SymmetricKey.generate().getBuffer())}`,
        publisherCredential: PUBLISHER,
      });

      const lagging = await rotation.laggingRoot(makeSession(5));

      expect(lagging?.getBuffer()).toEqual(root.getBuffer());
    });

    it('returns null for a current or missing entry', async () => {
      const { rotation, sealedSecrets } = setup();

      await expect(rotation.laggingRoot(makeSession(5))).resolves.toBeNull();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 5,
        generation: 8,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });

      await expect(rotation.laggingRoot(makeSession(5))).resolves.toBeNull();
    });
  });

  describe('handOver', () => {
    const HAND_OVER = {
      entries: [
        {
          recipientCredential: 'device-b',
          sealedSecret: 'sealed',
          signature: 'signed',
        },
      ],
      generation: 1_001,
    };

    it('seals a fresh root carrying the root of its own entry to the remaining devices at the retirement revision', async () => {
      const { rotation, sealedSecrets } = setup(1_000);
      const session = makeSession(4);
      const previous = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 7,
        payload: encodeBase64Url(previous.getBuffer()),
        publisherCredential: PUBLISHER,
      });
      sealedSecrets.sealHandOver.mockReturnValue(HAND_OVER);

      const handOver = await rotation.handOver(session, {
        authorizationRevision: 5,
        recipients: RECIPIENTS,
      });

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(sealedSecrets.sealHandOver).toHaveBeenCalledTimes(1);

      const [sealedBy, input] = sealedSecrets.sealHandOver.mock.calls[0];
      const [root, carried, ...rest] = input.payload.split('.');

      expect(sealedBy).toBe(session);
      expect(input.authorizationRevision).toBe(5);
      expect(input.generation).toBe(1_001);
      expect(input.recipients).toEqual(RECIPIENTS);
      expect(rest).toEqual([]);
      expect(decodeBase64Url(carried)).toEqual(previous.getBuffer());
      expect(decodeBase64Url(root)).not.toEqual(previous.getBuffer());
      expect(handOver?.root.getBuffer()).toEqual(decodeBase64Url(root));
      expect(handOver?.previous.getBuffer()).toEqual(previous.getBuffer());
      expect(handOver?.sealedSecrets).toBe(HAND_OVER);
    });

    it('carries only the root of an own entry that is itself a hand-over', async () => {
      const { rotation, sealedSecrets } = setup(1_000);
      const previous = SymmetricKey.generate();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 7,
        payload: `${encodeBase64Url(previous.getBuffer())}.${encodeBase64Url(SymmetricKey.generate().getBuffer())}`,
        publisherCredential: PUBLISHER,
      });
      sealedSecrets.sealHandOver.mockReturnValue(HAND_OVER);

      const handOver = await rotation.handOver(makeSession(4), {
        authorizationRevision: 5,
        recipients: RECIPIENTS,
      });

      const [, carried, ...rest] =
        sealedSecrets.sealHandOver.mock.calls[0][1].payload.split('.');

      expect(rest).toEqual([]);
      expect(decodeBase64Url(carried)).toEqual(previous.getBuffer());
      expect(handOver?.previous.getBuffer()).toEqual(previous.getBuffer());
    });

    it('issues a generation strictly greater than the stored one even when the clock is behind', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9_000,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });
      sealedSecrets.sealHandOver.mockReturnValue(HAND_OVER);

      await rotation.handOver(makeSession(4), {
        authorizationRevision: 5,
        recipients: RECIPIENTS,
      });

      expect(sealedSecrets.sealHandOver.mock.calls[0][1].generation).toBe(
        9_001,
      );
    });

    it('hands nothing over when this device has no entry naming the root the keychain is under', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      await expect(
        rotation.handOver(makeSession(4), {
          authorizationRevision: 5,
          recipients: RECIPIENTS,
        }),
      ).resolves.toBeNull();
      expect(sealedSecrets.sealHandOver).not.toHaveBeenCalled();
    });
  });

  describe('generation', () => {
    it('reads the generation of the own entry without exposing its payload', async () => {
      const { rotation, sealedSecrets } = setup();

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 5,
        generation: 8,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });

      await expect(rotation.generation(makeSession(5))).resolves.toBe(8);
    });

    it('returns null when this device has no entry', async () => {
      const { rotation } = setup();

      await expect(rotation.generation(makeSession(5))).resolves.toBeNull();
    });
  });

  describe('the publisher of the own entry', () => {
    const refusing = (reason: string) => {
      const context = setup(1_000);

      context.sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9_000,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });
      context.deviceAuthorization.verifyPublisher.mockRejectedValue(
        new Error(reason),
      );

      return context;
    };

    it('verifies the publisher against the signed transitions at the entry revision before opening', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup();
      const session = makeSession(4);

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 7,
        payload: encodeBase64Url(SymmetricKey.generate().getBuffer()),
        publisherCredential: PUBLISHER,
      });

      await rotation.current(session);

      expect(deviceAuthorization.verifyPublisher).toHaveBeenCalledTimes(1);

      const [verifiedBy, publisher, revision] =
        deviceAuthorization.verifyPublisher.mock.calls[0];

      expect(verifiedBy).toBe(session);
      expect(publisher).toBe(PUBLISHER);
      expect(revision.valueOf()).toBe(4);
    });

    it.each([
      ['an unauthorized publisher', UNAUTHORIZED],
      ['transitions it cannot prove', 'The transitions were not served.'],
    ])('yields no root and publishes nothing for %s', async (_case, reason) => {
      const { keychains, rotation, sealedSecrets } = refusing(reason);

      await expect(rotation.current(makeSession(4))).rejects.toThrow(reason);
      await expect(rotation.laggingRoot(makeSession(5))).rejects.toThrow(
        reason,
      );
      await expect(
        rotation.handOver(makeSession(4), {
          authorizationRevision: 5,
          recipients: RECIPIENTS,
        }),
      ).rejects.toThrow(reason);
      await expect(rotation.generation(makeSession(4))).rejects.toThrow(reason);
      await expect(rotation.rotate(makeSession(4))).rejects.toThrow(reason);
      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(sealedSecrets.sealHandOver).not.toHaveBeenCalled();
      expect(keychains.readHead).not.toHaveBeenCalled();
    });
  });

  describe('an own entry whose publisher was revoked after the entry revision', () => {
    const REVOKED =
      'Device sealed secret publisher was revoked after the entry revision.';
    const revokedLater = (root: SymmetricKey) => {
      const context = setup(1_000);

      context.sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9_000,
        payload: encodeBase64Url(root.getBuffer()),
        publisherCredential: PUBLISHER,
      });
      context.deviceAuthorization.verifyPublisher.mockRejectedValue(
        new RevokedDeviceSealedSecretPublisherError(),
      );

      return context;
    };

    it('yields no root this device never trusted and hands nothing over', async () => {
      const { keychains, rotation, sealedSecrets } = revokedLater(
        SymmetricKey.generate(),
      );

      await expect(rotation.laggingRoot(makeSession(5))).rejects.toThrow(
        REVOKED,
      );
      await expect(
        rotation.handOver(makeSession(5), {
          authorizationRevision: 6,
          recipients: RECIPIENTS,
        }),
      ).rejects.toThrow(REVOKED);
      await expect(rotation.generation(makeSession(5))).rejects.toThrow(
        REVOKED,
      );
      expect(sealedSecrets.sealHandOver).not.toHaveBeenCalled();
      expect(keychains.readHead).not.toHaveBeenCalled();
    });

    it('yields the root this device trusted when it opened that entry while its publisher was authorized', async () => {
      const root = SymmetricKey.generate();
      const { deviceAuthorization, rotation } = revokedLater(root);

      deviceAuthorization.verifyPublisher.mockResolvedValueOnce(undefined);
      await rotation.current(makeSession(4));

      const lagging = await rotation.laggingRoot(makeSession(5));

      expect(lagging?.getBuffer().equals(root.getBuffer())).toBe(true);
    });

    it('trusts the root this device last published, and no root it replaced', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const before = await rotation.rotate(makeSession(4));
      const after = await rotation.rotate(makeSession(4));
      const entryOf = (session: SessionWithRoot) => ({
        authorizationRevision: 4,
        generation: 9_000,
        payload: encodeBase64Url(
          (session.deviceSealedRootKey as SymmetricKey).getBuffer(),
        ),
        publisherCredential: PUBLISHER,
      });

      deviceAuthorization.verifyPublisher.mockRejectedValue(
        new RevokedDeviceSealedSecretPublisherError(),
      );
      sealedSecrets.fetchOwn.mockResolvedValue(entryOf(after));

      const lagging = await rotation.laggingRoot(makeSession(5));

      expect(
        lagging
          ?.getBuffer()
          .equals((after.deviceSealedRootKey as SymmetricKey).getBuffer()),
      ).toBe(true);
      sealedSecrets.fetchOwn.mockResolvedValue(entryOf(before));
      await expect(rotation.laggingRoot(makeSession(5))).rejects.toThrow(
        REVOKED,
      );
    });

    it('still issues a generation above that entry when this device revokes its publisher', async () => {
      const { rotation, sealedSecrets } = revokedLater(SymmetricKey.generate());

      await rotation.rotate(makeSession(5));

      expect(sealedSecrets.publish.mock.calls[0][1].generation).toBe(9_001);
    });

    it('keeps the trusted root apart per identity', async () => {
      const root = SymmetricKey.generate();
      const { deviceAuthorization, rotation } = revokedLater(root);
      const other = {
        ...makeSession(5),
        identity: { id: '00000000-0000-4000-8000-000000000002' },
      } as unknown as SessionWithRoot;

      deviceAuthorization.verifyPublisher.mockResolvedValueOnce(undefined);
      await rotation.current(makeSession(4));

      await expect(rotation.laggingRoot(other)).rejects.toThrow(REVOKED);
    });
  });
});
