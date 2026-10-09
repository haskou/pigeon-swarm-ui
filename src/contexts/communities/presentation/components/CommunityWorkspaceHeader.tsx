import type {
  Community,
  CommunityTextChannel,
  NotificationScopeSetting,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityHeader } from './CommunityHeader';
import { CommunityHeaderActionsMenu } from './CommunityHeaderActionsMenu';
import { CommunityMessageSearchToggle } from './CommunityMessageSearchToggle';

type CommunityWorkspaceHeaderProps = {
  avatarUrl: null | string;
  canAddMember: boolean;
  channelEncryptionReady: boolean;
  channelEncryptionTooltip: string;
  community: Community;
  communityIsPublic: boolean;
  communityLeaveError: null | string;
  communityLeaving: boolean;
  communityMenuOpen: boolean;
  communityNotificationSetting: NotificationScopeSetting;
  messageSearchOpen: boolean;
  networkName: string;
  onAddMember: () => void;
  onCommunityDataOpen: () => void;
  onCommunityMenuClose: () => void;
  onCommunityMenuToggle: () => void;
  onEncryptionDetailsOpen: () => void;
  onLeaveCommunity: () => void;
  onMessageSearchToggle: () => void;
  onNotificationMuteToggle: () => void;
  onNotificationSettingsOpen: () => void;
  onOpenAvatar: () => void;
  onOpenMobileSidebar: () => void;
  onPinsOpen: () => void;
  onRealtimeEventsOpen?: () => void;
  realtimeStatus: 'connected' | 'reconnecting';
  selectedChannel?: CommunityTextChannel;
};

export function CommunityWorkspaceHeader({
  avatarUrl,
  canAddMember,
  channelEncryptionReady,
  channelEncryptionTooltip,
  community,
  communityIsPublic,
  communityLeaveError,
  communityLeaving,
  communityMenuOpen,
  communityNotificationSetting,
  messageSearchOpen,
  networkName,
  onAddMember,
  onCommunityDataOpen,
  onCommunityMenuClose,
  onCommunityMenuToggle,
  onEncryptionDetailsOpen,
  onLeaveCommunity,
  onMessageSearchToggle,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  onOpenAvatar,
  onOpenMobileSidebar,
  onPinsOpen,
  onRealtimeEventsOpen,
  realtimeStatus,
  selectedChannel,
}: CommunityWorkspaceHeaderProps) {
  return (
    <CommunityHeader
      avatarUrl={avatarUrl}
      channelEncryptionReady={channelEncryptionReady}
      channelEncryptionTooltip={channelEncryptionTooltip}
      channelPublic={communityIsPublic}
      community={community}
      communityLeaveError={communityLeaveError}
      communityMenuOpen={communityMenuOpen}
      menuContent={
        <CommunityHeaderActionsMenu
          communityLeaving={communityLeaving}
          notificationSetting={communityNotificationSetting}
          onAddMember={canAddMember ? onAddMember : undefined}
          onClose={onCommunityMenuClose}
          onCommunityDataOpen={onCommunityDataOpen}
          onLeaveCommunity={onLeaveCommunity}
          onNotificationMuteToggle={onNotificationMuteToggle}
          onNotificationSettingsOpen={onNotificationSettingsOpen}
          onOpenPins={selectedChannel ? onPinsOpen : undefined}
          onRealtimeEventsOpen={onRealtimeEventsOpen}
          open={communityMenuOpen}
        />
      }
      networkName={networkName}
      onCommunityMenuToggle={onCommunityMenuToggle}
      onEncryptionDetailsOpen={onEncryptionDetailsOpen}
      onOpenAvatar={avatarUrl ? onOpenAvatar : undefined}
      onOpenMobileSidebar={onOpenMobileSidebar}
      onPinsOpen={onPinsOpen}
      onRealtimeEventsOpen={onRealtimeEventsOpen}
      realtimeStatus={realtimeStatus}
      selectedChannel={selectedChannel}
    >
      {communityIsPublic ? (
        <CommunityMessageSearchToggle
          onToggle={onMessageSearchToggle}
          open={messageSearchOpen}
        />
      ) : null}
    </CommunityHeader>
  );
}
