import { startCallHeartbeatLoop } from '../../../../../app/presentation/workspace/components/startCallHeartbeatLoop';

describe(startCallHeartbeatLoop.name, () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends one heartbeat per interval', async () => {
    const heartbeat = jest.fn().mockResolvedValue(undefined);
    const stop = startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
    });

    await flushPromises();
    expect(heartbeat).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(heartbeat).toHaveBeenCalledTimes(2);

    stop();
  });

  it('does not overlap slow heartbeat requests', async () => {
    let resolveHeartbeat: (() => void) | undefined;
    const heartbeat = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHeartbeat = resolve;
        }),
    );
    const stop = startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
    });

    jest.advanceTimersByTime(6000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    resolveHeartbeat?.();
    await flushPromises();
    jest.advanceTimersByTime(2000);
    expect(heartbeat).toHaveBeenCalledTimes(2);

    stop();
  });

  it('continues retrying after consecutive heartbeat failures', async () => {
    const heartbeat = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
    });

    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(heartbeat).toHaveBeenCalledTimes(4);
  });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
