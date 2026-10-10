import { setTimeout as sleep } from 'node:timers/promises';

import { watchMicrophoneAvailability } from '../../../../../contexts/calls/infrastructure/media/microphoneAvailability';

class FakePermissionStatus extends EventTarget {
  public constructor(public state: PermissionState) {
    super();
  }

  public change(state: PermissionState): void {
    this.state = state;
    this.dispatchEvent(new Event('change'));
  }
}

async function settle(): Promise<void> {
  await sleep(0);
}

function permissionFrom(status: FakePermissionStatus) {
  return () => Promise.resolve(status as unknown as PermissionStatus);
}

describe('watchMicrophoneAvailability', () => {
  it('reports a plugged-in device when microphone permission is already granted', async () => {
    const devices = new EventTarget();
    const permission = new FakePermissionStatus('granted');
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      devices,
      permission: permissionFrom(permission),
    });
    await settle();
    devices.dispatchEvent(new Event('devicechange'));

    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it('does not report a plugged-in device while permission is still denied', async () => {
    const devices = new EventTarget();
    const permission = new FakePermissionStatus('denied');
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      devices,
      permission: permissionFrom(permission),
    });
    await settle();
    devices.dispatchEvent(new Event('devicechange'));

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('does not report a plugged-in device while permission would still prompt', async () => {
    const devices = new EventTarget();
    const permission = new FakePermissionStatus('prompt');
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      devices,
      permission: permissionFrom(permission),
    });
    await settle();
    devices.dispatchEvent(new Event('devicechange'));

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('reports when microphone permission is granted after it was denied', async () => {
    const permission = new FakePermissionStatus('denied');
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      permission: permissionFrom(permission),
    });
    await settle();
    permission.change('granted');

    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it('does not report a permission change that is not a grant', async () => {
    const permission = new FakePermissionStatus('denied');
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      permission: permissionFrom(permission),
    });
    await settle();
    permission.change('prompt');

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('never reports without the permissions API, so it cannot prompt on its own', () => {
    const devices = new EventTarget();
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, { devices });
    devices.dispatchEvent(new Event('devicechange'));

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('never reports when the permissions API rejects the microphone query', async () => {
    const devices = new EventTarget();
    const onAvailable = jest.fn();

    watchMicrophoneAvailability(onAvailable, {
      devices,
      permission: () =>
        Promise.reject(
          new TypeError('microphone is not a valid permission name'),
        ),
    });
    await settle();
    devices.dispatchEvent(new Event('devicechange'));

    expect(onAvailable).not.toHaveBeenCalled();
  });

  it('stops reporting once the cleanup has run, even if the permission resolves later', async () => {
    const devices = new EventTarget();
    const permission = new FakePermissionStatus('granted');
    const onAvailable = jest.fn();

    const stop = watchMicrophoneAvailability(onAvailable, {
      devices,
      permission: permissionFrom(permission),
    });
    stop();
    await settle();
    devices.dispatchEvent(new Event('devicechange'));
    permission.change('granted');

    expect(onAvailable).not.toHaveBeenCalled();
  });
});
