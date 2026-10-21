import { HttpConnectionError } from '../../../../shared/infrastructure/http/HttpConnectionError';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import {
  isNodeStarting,
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

  it('also reads again on a failure the caller marks as retriable', async () => {
    const refused = new HttpConnectionError(new TypeError('Failed to fetch'));
    const read = jest
      .fn()
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce(notReadyError())
      .mockResolvedValueOnce('value');
    const isRetriable = jest.fn(
      (caught: unknown) => caught instanceof HttpConnectionError,
    );
    const pending = retryReplicatedStateRead(read, { isRetriable });

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe('value');
    expect(read).toHaveBeenCalledTimes(3);
    expect(isRetriable).toHaveBeenCalledWith(refused);
  });

  describe(isNodeStarting.name, () => {
    it.each([
      [
        'a refused connection',
        new HttpConnectionError(new TypeError('Failed to fetch')),
      ],
      ['a proxy 502', new HttpJsonError(502, 'Bad Gateway', '')],
      ['an uncoded 503', new HttpJsonError(503, 'Service Unavailable', '')],
    ])('marks %s as a node that is starting', (_label, caught) => {
      expect(isNodeStarting(caught)).toBe(true);
    });

    it.each([
      [
        'a coded 503 other than 503020',
        new HttpJsonError(503, 'Unavailable', JSON.stringify({ code: 503010 })),
      ],
      ['a 500', new HttpJsonError(500, 'Server Error', '')],
      ['another error', new Error('offline')],
      [
        'a TypeError thrown before any request was sent',
        new TypeError('Cannot read properties of undefined'),
      ],
    ])('does not mark %s as a node that is starting', (_label, caught) => {
      expect(isNodeStarting(caught)).toBe(false);
    });
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
