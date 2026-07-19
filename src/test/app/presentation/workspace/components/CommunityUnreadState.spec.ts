import { describe, expect, it } from '@jest/globals';

import { CommunityUnreadState } from '../../../../../app/presentation/workspace/components/CommunityUnreadState';
import { NotificationSettingsPolicy } from '../../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';

describe('CommunityUnreadState', () => {
  it('excludes muted channels and totals visible unread messages', () => {
    const visible = CommunityUnreadState.visibleCounts(
      {
        community: { general: 2, muted: 4 },
      },
      {
        [NotificationSettingsPolicy.key({
          channelId: 'muted',
          communityId: 'community',
          type: 'community_channel',
        })]: {
          hideMutedChannels: false,
          mobilePushEnabled: true,
          mutedUntil: null,
          notificationLevel: 'none',
          scope: {
            channelId: 'muted',
            communityId: 'community',
            type: 'community_channel',
          },
          suppressEveryoneAndHere: false,
          suppressRoleMentions: false,
          updatedAt: 1,
        },
      },
    );

    expect(visible).toEqual({ community: { general: 2 } });
    expect(CommunityUnreadState.totals(visible)).toEqual({ community: 2 });
  });

  it('increments and clears one channel without mutating other counts', () => {
    const initial = { community: { general: 2 }, other: { chat: 3 } };
    const incremented = CommunityUnreadState.withIncrementedChannel(
      initial,
      'community',
      'general',
    );

    expect(incremented).toEqual({
      community: { general: 3 },
      other: { chat: 3 },
    });
    expect(
      CommunityUnreadState.withoutChannel(incremented, 'community', 'general'),
    ).toEqual({ community: {}, other: { chat: 3 } });
    expect(initial).toEqual({ community: { general: 2 }, other: { chat: 3 } });
  });
});
