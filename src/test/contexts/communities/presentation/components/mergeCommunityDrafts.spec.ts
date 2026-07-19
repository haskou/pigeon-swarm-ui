import { describe, expect, it } from '@jest/globals';

import { mergeCommunityDrafts } from '../../../../../contexts/communities/presentation/components/mergeCommunityDrafts';

describe(mergeCommunityDrafts.name, () => {
  it('adds remote drafts for the active community without replacing local edits', () => {
    const drafts = mergeCommunityDrafts(
      { 'channel-a': 'local edit' },
      [
        {
          channelId: 'channel-a',
          communityId: 'community-a',
          content: 'remote edit',
        },
        {
          channelId: 'channel-b',
          communityId: 'community-a',
          content: 'remote draft',
        },
        {
          channelId: 'channel-c',
          communityId: 'community-b',
          content: 'other community',
        },
      ],
      'community-a',
    );

    expect(drafts).toEqual({
      'channel-a': 'local edit',
      'channel-b': 'remote draft',
    });
  });
});
