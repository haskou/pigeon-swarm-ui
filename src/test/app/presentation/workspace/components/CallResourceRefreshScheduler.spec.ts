import { CallResourceRefreshScheduler } from '../../../../../app/presentation/workspace/components/CallResourceRefreshScheduler';

function deferredPromise(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('CallResourceRefreshScheduler', () => {
  it('runs one trailing refresh after events arrive during an active load', async () => {
    const firstRefresh = deferredPromise();
    const trailingRefresh = deferredPromise();
    const refresh = jest
      .fn<Promise<void>, [string, string]>()
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(trailingRefresh.promise);
    const scheduler = new CallResourceRefreshScheduler(refresh);

    scheduler.request('call-1', 'calls.v1.participant.joined');
    scheduler.request('call-1', 'calls.v1.participant.left');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenNthCalledWith(
      1,
      'call-1',
      'calls.v1.participant.joined',
    );

    firstRefresh.resolve();
    await flushPromises();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenNthCalledWith(
      2,
      'call-1',
      'calls.v1.participant.left',
    );

    trailingRefresh.resolve();
    await flushPromises();
  });

  it('coalesces a burst into the latest trailing event', async () => {
    const firstRefresh = deferredPromise();
    const refresh = jest
      .fn<Promise<void>, [string, string]>()
      .mockReturnValueOnce(firstRefresh.promise)
      .mockResolvedValue(undefined);
    const scheduler = new CallResourceRefreshScheduler(refresh);

    scheduler.request('call-1', 'calls.v1.participant.joined');
    scheduler.request('call-1', 'calls.v1.participant.left');
    scheduler.request('call-1', 'calls.v1.call.ended');

    firstRefresh.resolve();
    await flushPromises();

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenLastCalledWith('call-1', 'calls.v1.call.ended');
  });
});
