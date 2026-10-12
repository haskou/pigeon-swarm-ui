import { useMemo } from 'react';

import type { CommunityTextChannelResource as CommunityTextChannel } from '../../infrastructure/http/resources/CommunityTextChannelResource';
import type { CommunityVoiceChannelResource as CommunityVoiceChannel } from '../../infrastructure/http/resources/CommunityVoiceChannelResource';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../notifications/infrastructure/http/resources/NotificationScopeSettingResource';

import { CommunityChannelVisibility } from '../view-models/CommunityChannelVisibility';

type UseCommunityVisibleChannelsInput = {
  accessibleTextChannels: CommunityTextChannel[];
  accessibleVoiceChannels: CommunityVoiceChannel[];
  activeVoiceChannelId: null | string;
  channelNotificationSetting: (channel: {
    id: string;
  }) => NotificationScopeSetting;
  channelSearch: string;
  selectedChannelId: null | string;
  textChannelsWithThreads: CommunityTextChannel[];
};

type UseCommunityVisibleChannelsResult = {
  visibleTextChannels: CommunityTextChannel[];
  visibleVoiceChannels: CommunityVoiceChannel[];
};

export function useCommunityVisibleChannels({
  accessibleTextChannels,
  accessibleVoiceChannels,
  activeVoiceChannelId,
  channelNotificationSetting,
  channelSearch,
  selectedChannelId,
  textChannelsWithThreads,
}: UseCommunityVisibleChannelsInput): UseCommunityVisibleChannelsResult {
  const visibleTextChannels = useMemo(
    () =>
      CommunityChannelVisibility.text({
        accessibleChannels: accessibleTextChannels,
        channelNotificationSetting,
        channelsWithThreads: textChannelsWithThreads,
        query: channelSearch,
        selectedChannelId,
      }),
    [
      accessibleTextChannels,
      channelNotificationSetting,
      channelSearch,
      selectedChannelId,
      textChannelsWithThreads,
    ],
  );
  const visibleVoiceChannels = useMemo(
    () =>
      CommunityChannelVisibility.voice({
        accessibleChannels: accessibleVoiceChannels,
        activeVoiceChannelId,
        channelNotificationSetting,
        query: channelSearch,
      }),
    [
      accessibleVoiceChannels,
      activeVoiceChannelId,
      channelNotificationSetting,
      channelSearch,
    ],
  );

  return { visibleTextChannels, visibleVoiceChannels };
}
