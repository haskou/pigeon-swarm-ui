import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import {
  replicatedStateNotReadyCodes,
  replicatedStateRetryDelaysMs,
  retryReplicatedStateRead,
} from '../../../../shared/infrastructure/http/retryReplicatedStateRead';

const notReadyError = (): HttpJsonError =>
  new HttpJsonError(
    503,
    'Service Unavailable',
    JSON.stringify({ code: 503020 }),
  );

describe(retryReplicatedStateRead.name, () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the first answer without waiting', async () => {
    const read = jest.fn().mockResolvedValue('value');

    await expect(retryReplicatedStateRead(read)).resolves.toBe('value');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again while the node reports its replicated state is not ready', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(notReadyError())
      .mockRejectedValueOnce(notReadyError())
      .mockResolvedValueOnce('value');
    const pending = retryReplicatedStateRead(read);

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('resolves once the node opens on the last scheduled retry', async () => {
    const read = jest.fn();
    for (let attempt = 0; attempt < 8; attempt++) {
      read.mockRejectedValueOnce(notReadyError());
    }
    read.mockResolvedValueOnce('value');
    const pending = retryReplicatedStateRead(read);

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(read).toHaveBeenCalledTimes(9);
  });

  it('reports each wait on a 503020 answer so the caller can show the node is starting', async () => {
    const onNotReady = jest.fn();
    const read = jest
      .fn()
      .mockRejectedValueOnce(notReadyError())
      .mockRejectedValueOnce(notReadyError())
      .mockResolvedValueOnce('value');
    const pending = retryReplicatedStateRead(read, { onNotReady });

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(onNotReady).toHaveBeenCalledTimes(2);
  });

  it('reports each wait on a pending value too, so the caller can show the node is starting', async () => {
    const onNotReady = jest.fn();
    const read = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('value');
    const pending = retryReplicatedStateRead(read, {
      isPending: (value) => value === undefined,
      onNotReady,
    });

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(onNotReady).toHaveBeenCalledTimes(2);
  });

  it('stops reporting a wait once the schedule is spent', async () => {
    const onNotReady = jest.fn();
    const read = jest.fn().mockRejectedValue(notReadyError());
    const pending = retryReplicatedStateRead(read, { onNotReady });
    const settled = expect(pending).rejects.toBeInstanceOf(HttpJsonError);

    await jest.runAllTimersAsync();

    await settled;
    expect(onNotReady).toHaveBeenCalledTimes(8);
  });

  it('pins the retry codes and the 15.75s schedule', () => {
    expect([...replicatedStateNotReadyCodes]).toEqual(['503020']);
    expect(
      replicatedStateRetryDelaysMs.reduce((total, delay) => total + delay, 0),
    ).toBe(15_750);
  });

  it('rejects with the last failure once the bounded schedule is spent', async () => {
    const read = jest.fn().mockRejectedValue(notReadyError());
    const pending = retryReplicatedStateRead(read);
    const settled = expect(pending).rejects.toBeInstanceOf(HttpJsonError);

    await jest.runAllTimersAsync();

    await settled;
    expect(read).toHaveBeenCalledTimes(9);
  });

  it('does not retry failures other than 503020', async () => {
    const read = jest
      .fn()
      .mockRejectedValue(new HttpJsonError(500, 'Server Error', '{}'));

    await expect(retryReplicatedStateRead(read)).rejects.toBeInstanceOf(
      HttpJsonError,
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again while a value is still pending', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('value');
    const pending = retryReplicatedStateRead(read, {
      isPending: (value) => value === undefined,
    });

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('returns the pending value once the schedule is spent', async () => {
    const read = jest.fn().mockResolvedValue(undefined);
    const pending = retryReplicatedStateRead(read, {
      isPending: (value) => value === undefined,
    });

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBeUndefined();
    expect(read).toHaveBeenCalledTimes(9);
  });

  it('stops retrying once the caller aborts', async () => {
    const controller = new AbortController();
    const read = jest.fn().mockRejectedValue(notReadyError());
    const pending = retryReplicatedStateRead(read, {
      signal: controller.signal,
    });
    const settled = expect(pending).rejects.toThrow('aborted');

    await jest.advanceTimersByTimeAsync(300);
    controller.abort(new Error('aborted'));

    await settled;
    expect(read).toHaveBeenCalledTimes(2);
  });
});
