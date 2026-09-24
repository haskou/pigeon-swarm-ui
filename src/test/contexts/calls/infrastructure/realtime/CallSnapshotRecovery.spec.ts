import { CallSnapshotRecovery } from '../../../../../contexts/calls/infrastructure/realtime/CallSnapshotRecovery';

describe('CallSnapshotRecovery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coalesces requests and stops after three failed attempts', async () => {
    const recovery = new CallSnapshotRecovery();
    const load = jest.fn().mockRejectedValue(new Error('offline'));
    const apply = jest.fn();
    const failed = jest.fn();
    const first = recovery.request('call-a', load, apply, failed);
    expect(recovery.request('call-a', load, apply, failed)).toBe(first);
    await jest.advanceTimersByTimeAsync(10000);
    await first;
    expect(load).toHaveBeenCalledTimes(3);
    expect(apply).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('applies the first successful recovery without further polling', async () => {
    const recovery = new CallSnapshotRecovery();
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('snapshot');
    const apply = jest.fn();
    const done = recovery.request('call-a', load, apply, jest.fn());
    await jest.advanceTimersByTimeAsync(10000);
    await done;
    expect(load).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledWith('snapshot');
  });

  it('ignores an old connection response and cancels its retry timers', async () => {
    const recovery = new CallSnapshotRecovery();
    let resolveOld: (value: string) => void = () => undefined;
    const oldLoad = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const apply = jest.fn();
    const first = recovery.request('active-calls', oldLoad, apply, jest.fn());
    recovery.reset();
    await recovery.request(
      'active-calls',
      () => Promise.resolve('new'),
      apply,
      jest.fn(),
    );
    resolveOld('old');
    await first;
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('new');
    const failing = jest.fn().mockRejectedValue(new Error('offline'));
    const retry = recovery.request('call-a', failing, apply, jest.fn());
    await jest.advanceTimersByTimeAsync(100);
    recovery.reset();
    await retry;
    await jest.advanceTimersByTimeAsync(10000);
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
