import type { CommunityTextChannelResource as CommunityTextChannel } from '../../infrastructure/http/resources/CommunityTextChannelResource';
import type { CommunityVoiceChannelResource as CommunityVoiceChannel } from '../../infrastructure/http/resources/CommunityVoiceChannelResource';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../notifications/infrastructure/http/resources/NotificationScopeSettingResource';

import { NotificationSettingsPolicy } from '../../../notifications/presentation/view-models/NotificationSettingsPolicy';

type ChannelNotificationSetting = (channel: {
  id: string;
}) => NotificationScopeSetting;

export class CommunityChannelVisibility {
  public static text({
    accessibleChannels,
    channelNotificationSetting,
    channelsWithThreads,
    query,
    selectedChannelId,
  }: {
    accessibleChannels: CommunityTextChannel[];
    channelNotificationSetting: ChannelNotificationSetting;
    channelsWithThreads: CommunityTextChannel[];
    query: string;
    selectedChannelId: null | string;
  }): CommunityTextChannel[] {
    const visibleChannels = accessibleChannels
      .map(
        (channel) =>
          channelsWithThreads.find((item) => item.id === channel.id) ?? channel,
      )
      .filter(
        (channel) =>
          channel.id === selectedChannelId ||
          !NotificationSettingsPolicy.shouldHide(
            channelNotificationSetting(channel),
          ),
      );

    return CommunityChannelVisibility.matching(visibleChannels, query);
  }

  public static voice({
    accessibleChannels,
    activeVoiceChannelId,
    channelNotificationSetting,
    query,
  }: {
    accessibleChannels: CommunityVoiceChannel[];
    activeVoiceChannelId: null | string;
    channelNotificationSetting: ChannelNotificationSetting;
    query: string;
  }): CommunityVoiceChannel[] {
    const visibleChannels = accessibleChannels.filter(
      (channel) =>
        channel.id === activeVoiceChannelId ||
        !NotificationSettingsPolicy.shouldHide(
          channelNotificationSetting(channel),
        ),
    );

    return CommunityChannelVisibility.matching(visibleChannels, query);
  }

  private static matching<Channel extends { name: string }>(
    channels: Channel[],
    query: string,
  ): Channel[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return channels;

    return channels.filter((channel) =>
      channel.name.toLowerCase().includes(normalizedQuery),
    );
  }
}
