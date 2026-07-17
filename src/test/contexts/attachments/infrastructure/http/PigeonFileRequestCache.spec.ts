import { PigeonFileRequestCache } from '../../../../../contexts/attachments/infrastructure/http/PigeonFileRequestCache';

describe(PigeonFileRequestCache.name, () => {
  it('deduplicates concurrent requests for the same key', async () => {
    const cache = new PigeonFileRequestCache<string>();
    const load = jest.fn().mockResolvedValue('content');

    await expect(
      Promise.all([
        cache.getOrCreate('external-1', load),
        cache.getOrCreate('external-1', load),
      ]),
    ).resolves.toEqual(['content', 'content']);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
