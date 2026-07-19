import type { CommunityTextChannel } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityChannelThreadCache } from '../../../../../contexts/communities/presentation/view-models/CommunityChannelThreadCache';

describe('CommunityChannelThreadCache', () => {
  it('projects channel thread summaries without leaking channel resources', () => {
    const channels = [
      { id: 'channel-a', threads: [{ rootMessageId: 'message-a' }] },
      { id: 'channel-b' },
    ] as CommunityTextChannel[];

    expect(CommunityChannelThreadCache.fromChannels(channels)).toEqual({
      'channel-a': [{ rootMessageId: 'message-a' }],
      'channel-b': [],
    });
  });

  it('returns cached summaries only while they are fresh', () => {
    let now = 1_000;
    const cache = new CommunityChannelThreadCache(100, () => now);
    const threads = { 'channel-a': [] };

    cache.write('community-a', threads);
    expect(cache.read('community-a')).toBe(threads);

    now = 1_101;
    expect(cache.read('community-a')).toBeNull();
  });

  it('adds only missing label keys and preserves unchanged sets', () => {
    const current = new Set(['thread-a']);

    expect(
      CommunityChannelThreadCache.addLabelKeys(current, ['thread-a']),
    ).toBe(current);
    expect(
      CommunityChannelThreadCache.addLabelKeys(current, [
        'thread-a',
        'thread-b',
      ]),
    ).toEqual(new Set(['thread-a', 'thread-b']));
  });
});
