import { useCallback, useMemo } from 'react';

import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  Community,
  ConversationResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { useNotificationScopeSettings } from '../../../../contexts/notifications/presentation/hooks/useNotificationScopeSettings';

import { NotificationSettingsPolicy } from '../../../../contexts/notifications/domain/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';

type NotificationSettingsController = ReturnType<
  typeof useNotificationScopeSettings
>;

type WorkspaceNotificationActionsInput = {
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  openSettings: NotificationSettingsController['open'];
  settingsByScopeKey: NotificationSettingsController['settingsByScopeKey'];
  toggleMute: NotificationSettingsController['toggleMute'];
};

export function useWorkspaceNotificationActions({
  conversations,
  nodeNetworks,
  openSettings,
  settingsByScopeKey,
  toggleMute,
}: WorkspaceNotificationActionsInput) {
  const conversationsWithNotificationState = useMemo(
    () =>
      conversations.map((conversation) => {
        const setting = NotificationSettingsPolicy.resolve(
          settingsByScopeKey,
          {
            conversationId: conversation.id,
            type: 'conversation',
          },
        );

        return NotificationSettingsPolicy.isMuted(setting)
          ? { ...conversation, unreadCount: 0 }
          : conversation;
      }),
    [conversations, settingsByScopeKey],
  );

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
    conversationsWithNotificationState,
    openCommunitySettings,
    openConversationSettings,
    toggleCommunityMute,
    toggleConversationMute,
  };
}
