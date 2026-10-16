import type { CallMediaKey } from '../../../../../contexts/calls/infrastructure/media/CallMediaKey';

import { startCallMediaRekeyLoop } from '../../../../../app/presentation/workspace/components/startCallMediaRekeyLoop';
import { logCallWarning } from '../../../../../contexts/calls/infrastructure/media/callDebugLogger';

jest.mock(
  '../../../../../contexts/calls/infrastructure/media/callDebugLogger',
  () => ({ logCallWarning: jest.fn() }),
);

const intervalMs = 1000;

function keyIn(epoch: number): CallMediaKey {
  return { epoch, key: `key-${epoch}` };
}

describe(startCallMediaRekeyLoop.name, () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rekeys the call only when its key moves to a newer epoch', async () => {
    const currentKey = jest
      .fn<Promise<CallMediaKey>, []>()
      .mockResolvedValueOnce(keyIn(2))
      .mockResolvedValueOnce(keyIn(2))
      .mockResolvedValueOnce(keyIn(1))
      .mockResolvedValueOnce(keyIn(3));
    const rekey = jest.fn();
    const stop = startCallMediaRekeyLoop({
      callId: 'call-1',
      currentKey,
      intervalMs,
      rekey,
    });

    await jest.advanceTimersByTimeAsync(intervalMs * 4);

    expect(currentKey).toHaveBeenCalledTimes(4);
    expect(rekey.mock.calls).toEqual([[keyIn(2)], [keyIn(3)]]);

    stop();
  });

  it('waits for a slow key lookup before polling again', async () => {
    let resolveKey: ((key: CallMediaKey) => void) | undefined;
    const currentKey = jest.fn(
      () =>
        new Promise<CallMediaKey>((resolve) => {
          resolveKey = resolve;
        }),
    );
    const stop = startCallMediaRekeyLoop({
      callId: 'call-1',
      currentKey,
      intervalMs,
      rekey: jest.fn(),
    });

    await jest.advanceTimersByTimeAsync(intervalMs * 5);
    expect(currentKey).toHaveBeenCalledTimes(1);

    resolveKey?.(keyIn(1));
    await jest.advanceTimersByTimeAsync(intervalMs);
    expect(currentKey).toHaveBeenCalledTimes(2);

    stop();
  });

  it('stops polling and drops a key that lands after it stopped', async () => {
    let resolveKey: ((key: CallMediaKey) => void) | undefined;
    const currentKey = jest.fn(
      () =>
        new Promise<CallMediaKey>((resolve) => {
          resolveKey = resolve;
        }),
    );
    const rekey = jest.fn();
    const stop = startCallMediaRekeyLoop({
      callId: 'call-1',
      currentKey,
      intervalMs,
      rekey,
    });

    await jest.advanceTimersByTimeAsync(intervalMs);
    stop();
    resolveKey?.(keyIn(5));
    await jest.advanceTimersByTimeAsync(intervalMs * 5);

    expect(currentKey).toHaveBeenCalledTimes(1);
    expect(rekey).not.toHaveBeenCalled();
  });

  it('never polls once stopped before the first poll', async () => {
    const currentKey = jest.fn().mockResolvedValue(keyIn(1));
    const stop = startCallMediaRekeyLoop({
      callId: 'call-1',
      currentKey,
      intervalMs,
      rekey: jest.fn(),
    });

    stop();
    await jest.advanceTimersByTimeAsync(intervalMs * 5);

    expect(currentKey).not.toHaveBeenCalled();
  });

  it('logs a failed lookup and keeps polling', async () => {
    const failure = new Error('sync failed');
    const currentKey = jest
      .fn<Promise<CallMediaKey>, []>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(keyIn(4));
    const rekey = jest.fn();
    const stop = startCallMediaRekeyLoop({
      callId: 'call-1',
      currentKey,
      intervalMs,
      rekey,
    });

    await jest.advanceTimersByTimeAsync(intervalMs * 2);

    expect(rekey).toHaveBeenCalledWith(keyIn(4));
    expect(jest.mocked(logCallWarning).mock.calls).toEqual([
      [
        'workspace:call-media-rekey:failed',
        { callId: 'call-1', error: failure },
      ],
    ]);

    stop();
  });
});
