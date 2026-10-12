import type { Dispatch, SetStateAction } from 'react';

import { useCallback, useMemo } from 'react';

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
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  openSettings: Dispatch<
    SetStateAction<NotificationScopeSettingsTarget | null>
  >;
  settingsByScopeKey: NotificationSettingMap;
  toggleMute: (scope: NotificationSettingScope) => void;
};

export function useWorkspaceNotificationActions({
  conversations,
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
  conversationsWithNotificationState: ConversationResource[];
  openCommunitySettings: (community: Community) => void;
  openConversationSettings: (
    conversation: ConversationResource,
    title: string,
  ) => void;
  toggleCommunityMute: (community: Community) => void;
  toggleConversationMute: (conversation: ConversationResource) => void;
} {
  const conversationsWithNotificationState = useMemo(
    () =>
      conversations.map((conversation) => {
        const setting = NotificationSettingsPolicy.resolve(settingsByScopeKey, {
          conversationId: conversation.id,
          type: 'conversation',
        });

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
