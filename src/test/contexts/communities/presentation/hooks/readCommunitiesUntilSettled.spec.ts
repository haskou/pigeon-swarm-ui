import { CommunityListNotSettledError } from '../../../../../contexts/communities/presentation/hooks/CommunityListNotSettledError';
import { readCommunitiesUntilSettled } from '../../../../../contexts/communities/presentation/hooks/readCommunitiesUntilSettled';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

const community = { id: 'community-1' } as never;
const delaysMs = [1, 1, 1];

function notReady(): HttpJsonError {
  return new HttpJsonError(
    503,
    'Service Unavailable',
    JSON.stringify({ code: 503020 }),
  );
}

describe('readCommunitiesUntilSettled', () => {
  it('answers a new user with an empty list at once, without a second read', async () => {
    const read = jest.fn().mockResolvedValue([]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).resolves.toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('answers a non-empty list at once for a device that had communities', async () => {
    const read = jest.fn().mockResolvedValue([community]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).resolves.toEqual([community]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reads again while a device that had communities is told the list is empty', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([community]);
    const waiting = jest.fn();

    await expect(
      readCommunitiesUntilSettled({
        delaysMs,
        hadCommunities: true,
        onWaiting: waiting,
        read,
      }),
    ).resolves.toEqual([community]);
    expect(read).toHaveBeenCalledTimes(3);
    expect(waiting).toHaveBeenCalled();
  });

  it('never reports an empty list for a device that had communities once the budget is spent', async () => {
    const read = jest.fn().mockResolvedValue([]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toBeInstanceOf(CommunityListNotSettledError);
    expect(read).toHaveBeenCalledTimes(delaysMs.length + 1);
  });

  it('keeps reading past the 503020 answer of a node whose state is not ready', async () => {
    const read = jest
      .fn()
      .mockRejectedValueOnce(notReady())
      .mockRejectedValueOnce(notReady())
      .mockResolvedValueOnce([community]);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).resolves.toEqual([community]);
  });

  it('throws the 503020 failure when the budget is spent, never an empty list', async () => {
    const read = jest.fn().mockRejectedValue(notReady());

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: false, read }),
    ).rejects.toBeInstanceOf(HttpJsonError);
  });

  it.each([
    ['a 502 answer', new HttpJsonError(502, 'Bad Gateway', '')],
    ['a 503 answer without a code', new HttpJsonError(503, 'Unavailable', '')],
    ['a 504 answer', new HttpJsonError(504, 'Gateway Timeout', '')],
    ['a refused connection', new TypeError('Failed to fetch')],
  ])(
    'keeps reading past %s of a node that is starting',
    async (_name, failure) => {
      const read = jest
        .fn()
        .mockRejectedValueOnce(failure)
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce([community]);
      const waiting = jest.fn();

      await expect(
        readCommunitiesUntilSettled({
          delaysMs,
          hadCommunities: false,
          onWaiting: waiting,
          read,
        }),
      ).resolves.toEqual([community]);
      expect(read).toHaveBeenCalledTimes(3);
      expect(waiting).toHaveBeenCalledTimes(2);
    },
  );

  it('throws the last startup failure when the budget is spent', async () => {
    const failure = new TypeError('Failed to fetch');
    const read = jest.fn().mockRejectedValue(failure);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toBe(failure);
    expect(read).toHaveBeenCalledTimes(delaysMs.length + 1);
  });

  it.each([
    ['a 500 answer', new HttpJsonError(500, 'Internal Server Error', '')],
    ['a 404 answer', new HttpJsonError(404, 'Not Found', '')],
  ])('does not retry %s', async (_name, failure) => {
    const read = jest.fn().mockRejectedValue(failure);

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toBe(failure);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('does not retry other failures', async () => {
    const read = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(
      readCommunitiesUntilSettled({ delaysMs, hadCommunities: true, read }),
    ).rejects.toThrow('offline');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('stops waiting as soon as it is aborted', async () => {
    const controller = new AbortController();
    const read = jest.fn().mockImplementation(() => {
      setTimeout(() => controller.abort(new Error('stop')), 1);

      return Promise.resolve([]);
    });

    await expect(
      readCommunitiesUntilSettled({
        budgetMs: 120_000,
        delaysMs: [60_000],
        hadCommunities: true,
        read,
        signal: controller.signal,
      }),
    ).rejects.toThrow('stop');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a read in flight when it is aborted', async () => {
    const controller = new AbortController();
    const read = jest.fn().mockReturnValue(new Promise<never[]>(() => {}));

    setTimeout(() => controller.abort(new Error('stop')), 1);

    await expect(
      readCommunitiesUntilSettled({
        delaysMs,
        hadCommunities: true,
        read,
        signal: controller.signal,
      }),
    ).rejects.toThrow('stop');
  });

  it('gives up when the wall-time budget is spent, before the delays are', async () => {
    const read = jest.fn().mockResolvedValue([]);

    await expect(
      readCommunitiesUntilSettled({
        budgetMs: 5,
        delaysMs: [1, 1, 1, 1000, 1000],
        hadCommunities: true,
        read,
      }),
    ).rejects.toBeInstanceOf(CommunityListNotSettledError);
    expect(read.mock.calls.length).toBeLessThan(6);
  });

  it('gives up on a persistent 503020 when the wall-time budget is spent', async () => {
    const read = jest.fn().mockRejectedValue(notReady());

    await expect(
      readCommunitiesUntilSettled({
        budgetMs: 5,
        delaysMs: [1, 1, 1000, 1000],
        hadCommunities: false,
        read,
      }),
    ).rejects.toBeInstanceOf(HttpJsonError);
  });

  it('starts no read when it is already aborted', async () => {
    const controller = new AbortController();
    const read = jest.fn().mockResolvedValue([]);

    controller.abort(new Error('stop'));

    await expect(
      readCommunitiesUntilSettled({
        delaysMs,
        hadCommunities: true,
        read,
        signal: controller.signal,
      }),
    ).rejects.toThrow('stop');
    expect(read).not.toHaveBeenCalled();
  });
});
