import { mock } from 'jest-mock-extended';

import type { DeviceRemovalWatchListener } from '../../../app/presentation/DeviceRemovalWatchListener';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';

import { DeviceRemovalWatch } from '../../../app/presentation/DeviceRemovalWatch';
import { DeviceRemovedError } from '../../../contexts/identities/domain/DeviceRemovedError';
import { DeviceAuthorizationRevision } from '../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { HttpJsonError } from '../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../shared/presentation/i18n/copy';

const BOUND = 30_000;

function session(revision: number): Session {
  return {
    authorizationRevision: DeviceAuthorizationRevision.fromNumber(revision),
    identity: { id: 'identity-1' },
  } as unknown as Session;
}

function watching(signedIn = session(1)) {
  let current = signedIn;
  const synchronize = jest.fn<Promise<Session>, [Session]>();
  const listener = mock<DeviceRemovalWatchListener>();
  const watch = new DeviceRemovalWatch(() => current, synchronize, listener);

  synchronize.mockImplementation((checked) => Promise.resolve(checked));
  listener.onAdvanced.mockImplementation((_, advanced) => {
    current = advanced;
  });
  watch.start();

  return { listener, synchronize, watch };
}

describe('DeviceRemovalWatch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('re-reads the signed transitions once per bound while signed in, not right after the sign-in verified them', async () => {
    const signedIn = session(1);
    const { synchronize, watch } = watching(signedIn);

    expect(DeviceRemovalWatch.CHECK_INTERVAL_MS).toBe(BOUND);

    await jest.advanceTimersByTimeAsync(BOUND - 1);
    expect(synchronize).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(synchronize).toHaveBeenCalledWith(signedIn);

    await jest.advanceTimersByTimeAsync(BOUND);
    expect(synchronize).toHaveBeenCalledTimes(2);

    watch.stop();
    await jest.advanceTimersByTimeAsync(BOUND * 3);
    expect(synchronize).toHaveBeenCalledTimes(2);
  });

  it('reports a verified removal of this device once, and checks no more', async () => {
    const { listener, synchronize } = watching();

    synchronize.mockRejectedValue(
      new DeviceRemovedError('identity-1', 'operation-1'),
    );

    await jest.advanceTimersByTimeAsync(BOUND);
    await jest.advanceTimersByTimeAsync(BOUND * 3);

    expect(listener.onRemoved).toHaveBeenCalledTimes(1);
    expect(listener.onRemoved).toHaveBeenCalledWith('identity-1');
    expect(synchronize).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'a node refusing the signed read',
      new HttpJsonError(401, 'Unauthorized', ''),
    ],
    ['a network failure', new TypeError('Failed to fetch')],
    [
      'a log that proves no removal',
      new Error(copy.auth.deviceAuthorizationUnproven),
    ],
  ])('never reports a removal on %s, and checks again', async (_, failure) => {
    const { listener, synchronize } = watching();

    synchronize.mockRejectedValue(failure);

    await jest.advanceTimersByTimeAsync(BOUND * 2);

    expect(listener.onRemoved).not.toHaveBeenCalled();
    expect(synchronize).toHaveBeenCalledTimes(2);
  });

  it('reports a newer verified head and checks from it next', async () => {
    const signedIn = session(1);
    const advanced = session(2);
    const { listener, synchronize } = watching(signedIn);

    synchronize.mockResolvedValueOnce(advanced);

    await jest.advanceTimersByTimeAsync(BOUND);
    expect(listener.onAdvanced).toHaveBeenCalledWith(signedIn, advanced);

    await jest.advanceTimersByTimeAsync(BOUND);
    expect(synchronize).toHaveBeenLastCalledWith(advanced);
    expect(listener.onAdvanced).toHaveBeenCalledTimes(1);
  });

  it('starts no check while the previous one is still reading', async () => {
    const { synchronize } = watching();

    synchronize.mockReturnValue(new Promise<Session>(() => undefined));

    await jest.advanceTimersByTimeAsync(BOUND * 3);

    expect(synchronize).toHaveBeenCalledTimes(1);
  });

  it('reports nothing that lands after it stopped', async () => {
    const { listener, synchronize, watch } = watching();
    let reject: (error: Error) => void = () => undefined;

    synchronize.mockReturnValue(
      new Promise<Session>((_, rejecting) => {
        reject = rejecting;
      }),
    );
    await jest.advanceTimersByTimeAsync(BOUND);
    watch.stop();
    reject(new DeviceRemovedError('identity-1', 'operation-1'));
    await jest.advanceTimersByTimeAsync(0);

    expect(listener.onRemoved).not.toHaveBeenCalled();
  });
});
