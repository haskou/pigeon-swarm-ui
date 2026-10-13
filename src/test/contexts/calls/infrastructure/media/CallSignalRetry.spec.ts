import { CallSignalRetry } from '../../../../../contexts/calls/infrastructure/media/CallSignalRetry';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

describe(CallSignalRetry.name, () => {
  afterEach(() => jest.useRealTimers());

  it.each([400, 401, 403, 404])('does not retry HTTP %s', async (status) => {
    const error = new HttpJsonError(
      status,
      'Error',
      '{"code":"CallParticipantNotFoundError"}',
    );
    const deliver = jest.fn<Promise<void>, []>().mockRejectedValue(error);

    await expect(new CallSignalRetry().send(deliver, () => true)).rejects.toBe(
      error,
    );
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('does not retry a terminal call error', async () => {
    const error = new HttpJsonError(
      409,
      'Conflict',
      '{"code":"InactiveCallError"}',
    );
    const deliver = jest.fn<Promise<void>, []>().mockRejectedValue(error);

    await expect(new CallSignalRetry().send(deliver, () => true)).rejects.toBe(
      error,
    );
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('bounds retries when the participant never becomes available', async () => {
    jest.useFakeTimers();
    const error = new HttpJsonError(
      409,
      'Conflict',
      '{"code":"CallParticipantNotFoundError"}',
    );
    const deliver = jest.fn<Promise<void>, []>().mockRejectedValue(error);
    const result = expect(
      new CallSignalRetry().send(deliver, () => true),
    ).rejects.toBe(error);

    await jest.advanceTimersByTimeAsync(5000);
    await result;
    expect(deliver).toHaveBeenCalledTimes(11);
  });

  it.each([
    ['a timeout', new DOMException('Timed out.', 'TimeoutError')],
    ['an abort', new DOMException('Aborted.', 'AbortError')],
    ['a network failure', new TypeError('Failed to fetch')],
    ['HTTP 429', new HttpJsonError(429, 'Too Many Requests', '')],
    ['HTTP 500', new HttpJsonError(500, 'Internal Server Error', '')],
    ['HTTP 503', new HttpJsonError(503, 'Service Unavailable', '')],
  ])('retries %s with backoff', async (_kind, error) => {
    jest.useFakeTimers();
    const deliver = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const result = new CallSignalRetry().send(deliver, () => true);

    await jest.advanceTimersByTimeAsync(499);
    expect(deliver).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(deliver).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(999);
    expect(deliver).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeUndefined();
    expect(deliver).toHaveBeenCalledTimes(3);
  });

  it('bounds retries of a transient failure', async () => {
    jest.useFakeTimers();
    const error = new HttpJsonError(503, 'Service Unavailable', '');
    const deliver = jest.fn<Promise<void>, []>().mockRejectedValue(error);
    const result = expect(
      new CallSignalRetry().send(deliver, () => true),
    ).rejects.toBe(error);

    await jest.advanceTimersByTimeAsync(60_000);
    await result;
    expect(deliver).toHaveBeenCalledTimes(4);
  });

  it('stops retrying once the signal is no longer current', async () => {
    jest.useFakeTimers();
    let current = true;
    const deliver = jest
      .fn<Promise<void>, []>()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const result = new CallSignalRetry().send(deliver, () => current);

    await jest.advanceTimersByTimeAsync(0);
    current = false;
    await jest.advanceTimersByTimeAsync(60_000);
    await expect(result).resolves.toBeUndefined();
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});
