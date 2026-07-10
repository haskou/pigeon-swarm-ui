import { startCallHeartbeatLoop } from './startCallHeartbeatLoop';

describe(startCallHeartbeatLoop.name, () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends one heartbeat per interval', async () => {
    const heartbeat = jest.fn().mockResolvedValue(undefined);
    const stop = startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
      onFailureLimit: jest.fn(),
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
      onFailureLimit: jest.fn(),
    });

    jest.advanceTimersByTime(6000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    resolveHeartbeat?.();
    await flushPromises();
    jest.advanceTimersByTime(2000);
    expect(heartbeat).toHaveBeenCalledTimes(2);

    stop();
  });

  it('stops after the configured number of consecutive failures', async () => {
    const heartbeat = jest.fn().mockRejectedValue(new Error('offline'));
    const onFailureLimit = jest.fn();

    startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
      onFailureLimit,
    });

    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();
    jest.advanceTimersByTime(10_000);
    await flushPromises();

    expect(heartbeat).toHaveBeenCalledTimes(3);
    expect(onFailureLimit).toHaveBeenCalledTimes(1);
  });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
