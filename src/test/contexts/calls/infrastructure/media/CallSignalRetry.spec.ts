import { CallSignalRetry } from '../../../../../contexts/calls/infrastructure/media/CallSignalRetry';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

describe(CallSignalRetry.name, () => {
  afterEach(() => jest.useRealTimers());

  it.each([401, 403, 500])('does not retry HTTP %s', async (status) => {
    const error = new HttpJsonError(
      status,
      'Error',
      '{"code":"CallParticipantNotFoundError"}',
    );
    const deliver = jest.fn().mockRejectedValue(error);

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
    const deliver = jest.fn().mockRejectedValue(error);

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
    const deliver = jest.fn().mockRejectedValue(error);
    const result = expect(
      new CallSignalRetry().send(deliver, () => true),
    ).rejects.toBe(error);

    await jest.advanceTimersByTimeAsync(5000);
    await result;
    expect(deliver).toHaveBeenCalledTimes(11);
  });
});
