import type { ForgetDeviceServices } from '../../../../../app/presentation/workspace/components/ForgetDeviceServices';
import type { OwnDeviceRetirement } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { forgetCurrentDevice } from '../../../../../app/presentation/workspace/components/forgetCurrentDevice';

const session = { identity: { id: 'identity-1' } } as unknown as Session;

function fakeServices({
  retirement,
  unlockFails = false,
}: {
  retirement: () => Promise<OwnDeviceRetirement>;
  unlockFails?: boolean;
}) {
  const calls: string[] = [];
  const services: ForgetDeviceServices = {
    directMessages: {
      releaseDeviceReaders: () => {
        calls.push('release');

        return Promise.resolve();
      },
    },
    identities: {
      forgetDeviceUnlock: (identityId) => {
        calls.push(`unlock:${identityId}`);

        return unlockFails
          ? Promise.reject(new Error('storage'))
          : Promise.resolve();
      },
      retireOwnDevice: () => {
        calls.push('retire');

        return retirement();
      },
    },
  };

  return { calls, services };
}

describe('forgetCurrentDevice', () => {
  it('revokes this device, releases its readers, then forgets the local unlock', async () => {
    const { calls, services } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'forgotten',
    );
    expect(calls).toEqual(['retire', 'release', 'unlock:identity-1']);
  });

  it('treats a device that is already revoked as forgotten', async () => {
    const { services } = fakeServices({
      retirement: () => Promise.resolve('already-revoked'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'forgotten',
    );
  });

  it('keeps the device signed in and the local unlock when revocation fails', async () => {
    const { calls, services } = fakeServices({
      retirement: () => Promise.reject(new Error('503')),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'revoke-failed',
    );
    expect(calls).toEqual(['retire']);
  });

  it('changes nothing for the only device until the user confirms', async () => {
    const { calls, services } = fakeServices({
      retirement: () => Promise.resolve('last-device'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'only-device',
    );
    expect(calls).toEqual(['retire']);
  });

  it('forgets only the local unlock for the only device once confirmed', async () => {
    const { calls, services } = fakeServices({
      retirement: () => Promise.resolve('last-device'),
    });

    await expect(forgetCurrentDevice(session, services, true)).resolves.toBe(
      'forgotten',
    );
    expect(calls).toEqual(['retire', 'unlock:identity-1']);
  });

  it('reports a failed local unlock removal after the device is already revoked', async () => {
    const { calls, services } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
      unlockFails: true,
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'unlock-failed',
    );
    expect(calls).toEqual(['retire', 'release', 'unlock:identity-1']);
  });
});
