import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';

describe(RequestCache.name, () => {
  it('shares an in-flight request for the same key', async () => {
    const cache = new RequestCache();
    let resolveRequest: ((value: string) => void) | undefined;
    const loader = jest.fn(
      async () =>
        await new Promise<string>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = cache.load('identity-1', loader);
    const second = cache.load('identity-1', loader);

    await Promise.resolve();
    resolveRequest?.('Ada');

    await expect(Promise.all([first, second])).resolves.toEqual(['Ada', 'Ada']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps settled values only for the configured TTL', async () => {
    jest.useFakeTimers();
    const cache = new RequestCache();
    const loader = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    await expect(
      cache.load('identity-1', loader, { ttlMs: 100 }),
    ).resolves.toBe('first');
    await expect(
      cache.load('identity-1', loader, { ttlMs: 100 }),
    ).resolves.toBe('first');

    jest.advanceTimersByTime(101);

    await expect(
      cache.load('identity-1', loader, { ttlMs: 100 }),
    ).resolves.toBe('second');
    expect(loader).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('evicts failed requests so they can be retried', async () => {
    const cache = new RequestCache();
    const loader = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('online');

    await expect(cache.load('presence', loader)).rejects.toThrow('offline');
    await expect(cache.load('presence', loader)).resolves.toBe('online');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('isolates session cache keys by identity', () => {
    const cache = new RequestCache();
    const first = { identity: { id: 'identity-1' } } as unknown as Session;
    const second = { identity: { id: 'identity-2' } } as unknown as Session;

    expect(cache.keyForSession('/calls/', first)).toBe(
      'GET /calls/ identity-1',
    );
    expect(cache.keyForSession('/calls/', second)).toBe(
      'GET /calls/ identity-2',
    );
  });
});
