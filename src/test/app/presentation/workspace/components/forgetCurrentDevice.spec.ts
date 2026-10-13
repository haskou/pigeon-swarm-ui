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
  const wiped: string[] = [];
  const cancelled: string[] = [];
  const services: ForgetDeviceServices = {
    directMessages: {
      cancelOutbox: (identityId) => {
        cancelled.push(identityId);

        return Promise.resolve();
      },
      forgetHistory: (identityId) => {
        wiped.push(identityId);

        return Promise.resolve();
      },
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

  return { calls, cancelled, services, wiped };
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

  it('wipes this identity direct history when the device is forgotten', async () => {
    const { services, wiped } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'forgotten',
    );
    expect(wiped).toEqual(['identity-1']);
  });

  it('keeps direct history when revocation fails', async () => {
    const { services, wiped } = fakeServices({
      retirement: () => Promise.reject(new Error('network')),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'revoke-failed',
    );
    expect(wiped).toEqual([]);
  });

  it('keeps direct history for the only device until the user confirms', async () => {
    const { services, wiped } = fakeServices({
      retirement: () => Promise.resolve('last-device'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'only-device',
    );
    expect(wiped).toEqual([]);
  });

  it('wipes direct history once revoked even when the local unlock removal fails', async () => {
    const { services, wiped } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
      unlockFails: true,
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'unlock-failed',
    );
    expect(wiped).toEqual(['identity-1']);
  });

  it('cancels queued one-to-one sends once the device is revoked', async () => {
    const { cancelled, services } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'forgotten',
    );
    expect(cancelled).toEqual(['identity-1']);
  });

  it('keeps queued one-to-one sends when revocation fails', async () => {
    const { cancelled, services } = fakeServices({
      retirement: () => Promise.reject(new Error('network')),
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'revoke-failed',
    );
    expect(cancelled).toEqual([]);
  });

  it('cancels queued sends once revoked even when the local unlock removal fails', async () => {
    const { cancelled, services } = fakeServices({
      retirement: () => Promise.resolve('revoked'),
      unlockFails: true,
    });

    await expect(forgetCurrentDevice(session, services, false)).resolves.toBe(
      'unlock-failed',
    );
    expect(cancelled).toEqual(['identity-1']);
  });
});
