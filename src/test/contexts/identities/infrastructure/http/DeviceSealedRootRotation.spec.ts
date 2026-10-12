import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import type { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { PigeonDeviceSealedSecretApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceSealedSecretApi';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { DeviceSealedRootRotation } from '../../../../../contexts/identities/infrastructure/http/DeviceSealedRootRotation';
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

const makeSession = (revision: number): SessionWithRoot =>
  ({
    authorizationRevision: { valueOf: () => revision },
    identity: { id: IDENTITY_ID },
    masterKey: SymmetricKey.generate(),
  }) as unknown as SessionWithRoot;

const setup = (clock = 1_000) => {
  const deviceAuthorization = mock<PigeonDeviceAuthorizationApi>();
  const sealedSecrets = mock<PigeonDeviceSealedSecretApi>();
  const rotation = new DeviceSealedRootRotation(
    deviceAuthorization,
    sealedSecrets,
    () => clock,
  );

  deviceAuthorization.findDevices.mockResolvedValue(RECIPIENTS);
  sealedSecrets.fetchOwn.mockResolvedValue(null);
  sealedSecrets.publish.mockResolvedValue(undefined);

  return { deviceAuthorization, rotation, sealedSecrets };
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
    });

    it('issues a generation strictly greater than the stored one even when the clock is behind', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 9_000,
        payload: 'stale',
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
      });

      const current = await rotation.current(makeSession(4));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(current.deviceSealedRootKey?.getBuffer().equals(root)).toBe(true);
    });

    it('re-syncs a stale session and opens its entry without publishing', async () => {
      const { deviceAuthorization, rotation, sealedSecrets } = setup(1_000);
      const root = SymmetricKey.generate();

      deviceAuthorization.synchronize.mockResolvedValue(makeSession(4));
      sealedSecrets.fetchOwn.mockResolvedValue({
        authorizationRevision: 4,
        generation: 8,
        payload: encodeBase64Url(root.getBuffer()),
      });

      const current = await rotation.current(makeSession(3));

      expect(sealedSecrets.publish).not.toHaveBeenCalled();
      expect(current.deviceSealedRootKey?.getBuffer()).toEqual(
        root.getBuffer(),
      );
    });

    it('publishes when this device has no entry yet', async () => {
      const { rotation, sealedSecrets } = setup(1_000);

      const current = await rotation.current(makeSession(4));

      expect(sealedSecrets.publish).toHaveBeenCalledTimes(1);
      expect(current.deviceSealedRootKey).toBeDefined();
    });
  });
});
