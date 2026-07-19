import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type { CommunityUnreadCounts } from './workspacePersistence';

import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';

export class CommunityUnreadState {
  public static visibleCounts(
    counts: CommunityUnreadCounts,
    settingsByScopeKey: NotificationSettingMap,
  ): CommunityUnreadCounts {
    return Object.fromEntries(
      Object.entries(counts).map(([communityId, channelCounts]) => [
        communityId,
        Object.fromEntries(
          Object.entries(channelCounts).filter(([channelId]) => {
            const setting = NotificationSettingsPolicy.resolve(
              settingsByScopeKey,
              {
                channelId,
                communityId,
                type: 'community_channel',
              },
            );

            return !NotificationSettingsPolicy.isMuted(setting);
          }),
        ),
      ]),
    );
  }

  public static totals(counts: CommunityUnreadCounts): Record<string, number> {
    return Object.fromEntries(
      Object.entries(counts).map(([communityId, channelCounts]) => [
        communityId,
        Object.values(channelCounts).reduce((total, count) => total + count, 0),
      ]),
    );
  }

  public static withoutChannel(
    counts: CommunityUnreadCounts,
    communityId: string,
    channelId: string,
  ): CommunityUnreadCounts {
    if (!counts[communityId]?.[channelId]) return counts;

    const nextCommunity = { ...counts[communityId] };

    delete nextCommunity[channelId];

    return {
      ...counts,
      [communityId]: nextCommunity,
    };
  }

  public static withIncrementedChannel(
    counts: CommunityUnreadCounts,
    communityId: string,
    channelId: string,
  ): CommunityUnreadCounts {
    return {
      ...counts,
      [communityId]: {
        ...(counts[communityId] ?? {}),
        [channelId]: (counts[communityId]?.[channelId] ?? 0) + 1,
      },
    };
  }
}
