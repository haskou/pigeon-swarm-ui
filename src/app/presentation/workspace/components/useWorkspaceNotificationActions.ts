import type { Dispatch, SetStateAction } from 'react';

import { useCallback } from 'react';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { NotificationScopeSettingResource } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingResource';
import type { NotificationSettingScopeResource as NotificationSettingScope } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationSettingScopeResource';
import type { NotificationScopeSettingsTarget } from '../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog';
import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';

import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';

type WorkspaceNotificationActionsInput = {
  nodeNetworks: NodeNetwork[];
  openSettings: Dispatch<
    SetStateAction<NotificationScopeSettingsTarget | null>
  >;
  settingsByScopeKey: NotificationSettingMap;
  toggleMute: (scope: NotificationSettingScope) => void;
};

export function useWorkspaceNotificationActions({
  nodeNetworks,
  openSettings,
  settingsByScopeKey,
  toggleMute,
}: WorkspaceNotificationActionsInput): {
  communitySettingFor: (
    community: Community,
  ) => NotificationScopeSettingResource;
  conversationSettingFor: (
    conversation: ConversationResource,
  ) => NotificationScopeSettingResource;
  openCommunitySettings: (community: Community) => void;
  openConversationSettings: (
    conversation: ConversationResource,
    title: string,
  ) => void;
  toggleCommunityMute: (community: Community) => void;
  toggleConversationMute: (conversation: ConversationResource) => void;
} {
  const conversationSettingFor = useCallback(
    (conversation: ConversationResource) =>
      NotificationSettingsPolicy.resolve(settingsByScopeKey, {
        conversationId: conversation.id,
        type: 'conversation',
      }),
    [settingsByScopeKey],
  );

  const communitySettingFor = useCallback(
    (community: Community) =>
      NotificationSettingsPolicy.resolve(settingsByScopeKey, {
        communityId: community.id,
        type: 'community',
      }),
    [settingsByScopeKey],
  );

  const openConversationSettings = useCallback(
    (conversation: ConversationResource, title: string) => {
      const networkName = conversation.networkId
        ? (nodeNetworks.find((network) => network.id === conversation.networkId)
            ?.name ?? conversation.networkId)
        : copy.profile.noNetworks;

      openSettings({
        scope: {
          conversationId: conversation.id,
          type: 'conversation',
        },
        subtitle: networkName,
        title,
      });
    },
    [nodeNetworks, openSettings],
  );

  const openCommunitySettings = useCallback(
    (community: Community) => {
      const network = nodeNetworks.find(
        (item) => item.id === community.networkId,
      );

      openSettings({
        scope: {
          communityId: community.id,
          type: 'community',
        },
        subtitle: network?.name ?? community.networkId,
        title: community.name,
      });
    },
    [nodeNetworks, openSettings],
  );

  const toggleConversationMute = useCallback(
    (conversation: ConversationResource) => {
      toggleMute({
        conversationId: conversation.id,
        type: 'conversation',
      });
    },
    [toggleMute],
  );

  const toggleCommunityMute = useCallback(
    (community: Community) => {
      toggleMute({
        communityId: community.id,
        type: 'community',
      });
    },
    [toggleMute],
  );

  return {
    communitySettingFor,
    conversationSettingFor,
    openCommunitySettings,
    openConversationSettings,
    toggleCommunityMute,
    toggleConversationMute,
  };
}
