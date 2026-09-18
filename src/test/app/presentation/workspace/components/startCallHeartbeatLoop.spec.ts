import { startCallHeartbeatLoop } from '../../../../../app/presentation/workspace/components/startCallHeartbeatLoop';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

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

  it('sends the next heartbeat immediately after a slow request', async () => {
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
    jest.runOnlyPendingTimers();
    expect(heartbeat).toHaveBeenCalledTimes(2);

    stop();
  });

  it('does not overlap slow heartbeat requests', () => {
    const heartbeat = jest.fn(() => new Promise<void>(() => undefined));
    const stop = startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
    });

    jest.advanceTimersByTime(20_000);

    expect(heartbeat).toHaveBeenCalledTimes(1);
    stop();
  });

  it.each([401, 403, 404])(
    'ends the local call and stops renewal after HTTP %s',
    async (status) => {
      const heartbeat = jest
        .fn()
        .mockRejectedValue(new HttpJsonError(status, 'Denied', ''));
      const onAccessDenied = jest.fn();
      startCallHeartbeatLoop({ callId: 'call-1', heartbeat, onAccessDenied });
      await flushPromises();
      await jest.advanceTimersByTimeAsync(10_000);
      expect(onAccessDenied).toHaveBeenCalledWith('call-1');
      expect(onAccessDenied).toHaveBeenCalledTimes(1);
      expect(heartbeat).toHaveBeenCalledTimes(1);
    },
  );

  it('ends only the explicit hidden-call denial among conflict responses', async () => {
    const onAccessDenied = jest.fn();
    const heartbeat = jest
      .fn()
      .mockRejectedValueOnce(
        new HttpJsonError(409, 'Conflict', '{"code":"OtherConflict"}'),
      )
      .mockRejectedValueOnce(
        new HttpJsonError(
          409,
          'Conflict',
          '{"code":"CallNotFoundError","message":"Call not found."}',
        ),
      );
    startCallHeartbeatLoop({ callId: 'call-1', heartbeat, onAccessDenied });
    await flushPromises();
    expect(onAccessDenied).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2000);
    expect(onAccessDenied).toHaveBeenCalledWith('call-1');
    await jest.advanceTimersByTimeAsync(10000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 503])(
    'keeps retrying temporary HTTP %s responses',
    async (status) => {
      const heartbeat = jest
        .fn()
        .mockRejectedValue(new HttpJsonError(status, 'Temporary failure', ''));
      const onAccessDenied = jest.fn();
      const stop = startCallHeartbeatLoop({
        callId: 'call-1',
        heartbeat,
        onAccessDenied,
      });
      await flushPromises();
      await jest.advanceTimersByTimeAsync(2000);
      expect(heartbeat).toHaveBeenCalledTimes(2);
      expect(onAccessDenied).not.toHaveBeenCalled();
      stop();
    },
  );

  it('ignores a denied response from a call whose heartbeat loop was stopped', async () => {
    let rejectHeartbeat: (reason: Error) => void = () => undefined;
    const heartbeat = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectHeartbeat = reject;
        }),
    );
    const onAccessDenied = jest.fn();
    const stop = startCallHeartbeatLoop({
      callId: 'call-1',
      heartbeat,
      onAccessDenied,
    });
    stop();
    rejectHeartbeat(new HttpJsonError(403, 'Denied', ''));
    await flushPromises();
    expect(onAccessDenied).not.toHaveBeenCalled();
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
