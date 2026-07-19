import { useCallback, useMemo } from 'react';

import type {
  Community,
  CommunityTextChannel,
  CommunityVoiceChannel,
  NotificationScopeSetting,
  NotificationSettingScope,
} from '../../../../shared/domain/pigeonResources.types';
import type { NotificationSettingMap } from '../../../notifications/presentation/view-models/NotificationSettingMap';

import { NotificationSettingsPolicy } from '../../../notifications/presentation/view-models/NotificationSettingsPolicy';
import { CommunityAccessPolicy } from '../view-models/CommunityAccessPolicy';
import { CommunityChannels } from '../view-models/CommunityChannels';
import { resolveCommunityChannelId } from './communityWorkspaceHelpers';

type UseCommunityChannelAccessInput = {
  activeChannelId?: null | string;
  community: Community;
  currentIdentityId: string;
  notificationSettingsByScopeKey: NotificationSettingMap;
};

type UseCommunityChannelAccessResult = {
  accessibleTextChannels: CommunityTextChannel[];
  accessibleVoiceChannels: CommunityVoiceChannel[];
  channelNotificationScope: (channelId: string) => NotificationSettingScope;
  channelNotificationSetting: (channel: {
    id: string;
  }) => NotificationScopeSetting;
  channelTopologyKey: string;
  communityNotificationScope: NotificationSettingScope;
  communityNotificationSetting: NotificationScopeSetting;
  currentPermissions: ReturnType<typeof CommunityAccessPolicy.permissionsFor>;
  currentRoleIds: ReturnType<typeof CommunityAccessPolicy.assignedRoleIdsFor>;
  resolvedChannelId: null | string;
  textChannels: CommunityTextChannel[];
  voiceChannels: CommunityVoiceChannel[];
};

export function useCommunityChannelAccess({
  activeChannelId,
  community,
  currentIdentityId,
  notificationSettingsByScopeKey,
}: UseCommunityChannelAccessInput): UseCommunityChannelAccessResult {
  const textChannels = useMemo(
    () => CommunityChannels.text(community),
    [community.channels, community.textChannels],
  );
  const voiceChannels = useMemo(
    () => CommunityChannels.voice(community),
    [community.channels, community.voiceChannels],
  );
  const channelTopologyKey = useMemo(
    () =>
      CommunityChannels.all(community)
        .map((channel) => `${channel.type}:${channel.id}`)
        .join('|'),
    [community.channels, community.textChannels, community.voiceChannels],
  );
  const currentPermissions = useMemo(
    () => CommunityAccessPolicy.permissionsFor(community, currentIdentityId),
    [community, currentIdentityId],
  );
  const currentRoleIds = useMemo(
    () =>
      CommunityAccessPolicy.assignedRoleIdsFor(community, currentIdentityId),
    [community, currentIdentityId],
  );
  const communityNotificationScope = useMemo<NotificationSettingScope>(
    () => ({ communityId: community.id, type: 'community' }),
    [community.id],
  );
  const communityNotificationSetting = useMemo(
    () =>
      NotificationSettingsPolicy.resolve(
        notificationSettingsByScopeKey,
        communityNotificationScope,
      ),
    [communityNotificationScope, notificationSettingsByScopeKey],
  );
  const channelNotificationScope = useCallback(
    (channelId: string): NotificationSettingScope => ({
      channelId,
      communityId: community.id,
      type: 'community_channel',
    }),
    [community.id],
  );
  const channelNotificationSetting = useCallback(
    (channel: { id: string }) =>
      NotificationSettingsPolicy.resolve(
        notificationSettingsByScopeKey,
        channelNotificationScope(channel.id),
      ),
    [channelNotificationScope, notificationSettingsByScopeKey],
  );
  const accessibleTextChannels = useMemo(
    () =>
      textChannels.filter((channel) =>
        CommunityAccessPolicy.canSeeChannel(
          community,
          channel,
          currentIdentityId,
        ),
      ),
    [community, currentIdentityId, textChannels],
  );
  const accessibleVoiceChannels = useMemo(
    () =>
      voiceChannels.filter((channel) =>
        CommunityAccessPolicy.canSeeChannel(
          community,
          channel,
          currentIdentityId,
        ),
      ),
    [community, currentIdentityId, voiceChannels],
  );
  const resolvedChannelId = useMemo(
    () => resolveCommunityChannelId(activeChannelId, accessibleTextChannels),
    [accessibleTextChannels, activeChannelId],
  );

  return {
    accessibleTextChannels,
    accessibleVoiceChannels,
    channelNotificationScope,
    channelNotificationSetting,
    channelTopologyKey,
    communityNotificationScope,
    communityNotificationSetting,
    currentPermissions,
    currentRoleIds,
    resolvedChannelId,
    textChannels,
    voiceChannels,
  };
}
