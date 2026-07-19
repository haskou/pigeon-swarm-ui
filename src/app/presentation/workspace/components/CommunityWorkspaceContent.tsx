import { Suspense, type ReactElement } from 'react';

import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type {
  Community,
  IdentityPresence,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { RailProps } from './Rail';
import type { useWorkspaceCalls } from './useWorkspaceCalls';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityWorkspaceStartupFallback } from './CommunityWorkspaceStartupFallback';
import { Rail } from './Rail';
import { CommunityWorkspace } from './workspaceLazyComponents';

type CommunityWorkspaceContentProps = {
  activeChannelId: null | string;
  activeCommunity?: Community;
  animateSidePanelEntries: boolean;
  callControls: Pick<
    ReturnType<typeof useWorkspaceCalls>,
    | 'activeCall'
    | 'leaveActiveCall'
    | 'retryMicrophone'
    | 'setParticipantScreenShareVolume'
    | 'setParticipantVolume'
    | 'setScreenShareQuality'
    | 'startCommunityVoiceCall'
    | 'toggleCallMediaEncryption'
    | 'toggleCallNoiseCancellation'
    | 'toggleCamera'
    | 'toggleDeafen'
    | 'toggleMute'
    | 'toggleScreenShare'
  >;
  channelUnreadCounts: Record<string, number>;
  communityRealtimeEvent: RealtimeDomainEvent | null;
  communityTypingIdentityIds: string[];
  error: Error | null;
  invitationAccepting: boolean;
  invitationError: string | null;
  invitationInviterName?: string;
  loading: boolean;
  membersOpen: boolean;
  nodeNetworks: Parameters<typeof CommunityWorkspace>[0]['nodeNetworks'];
  notificationSettingsByScopeKey: NotificationSettingMap;
  onChannelSelected: (communityId: string, channelId: string) => void;
  onChannelViewed: (communityId: string, channelId: string) => void;
  onCommunityChannelsUpdated: Parameters<
    typeof CommunityWorkspace
  >[0]['onCommunityChannelsUpdated'];
  onCommunityLeft: (community: Community) => void;
  onCommunityUpdated: (community: Community) => void;
  onInvitationAccept: (notification: NotificationResource) => void;
  onLogout: () => void;
  onMembersClose: () => void;
  onMembersOpen: () => void;
  onNotificationMuteToggle: Parameters<
    typeof CommunityWorkspace
  >[0]['onNotificationMuteToggle'];
  onNotificationSettingsOpen: Parameters<
    typeof CommunityWorkspace
  >[0]['onNotificationSettingsOpen'];
  onOpenConversationWithIdentity: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  onPresenceChange: (presence: IdentityPresence) => void;
  onPresenceStatusSelected: Parameters<
    typeof CommunityWorkspace
  >[0]['onPresenceStatusSelected'];
  onRealtimeEventsOpen: () => void;
  onSessionUpdated: (session: Session) => void;
  onSidebarClose: () => void;
  onSidebarOpen: () => void;
  pendingInvitation: Parameters<
    typeof CommunityWorkspace
  >[0]['pendingInvitation'];
  presenceByIdentityId: Record<string, IdentityPresence>;
  railProps: RailProps;
  realtimeStatus: 'connected' | 'reconnecting';
  sendCommunityTyping: Parameters<
    typeof CommunityWorkspace
  >[0]['onTypingActive'];
  session: Session;
  sidebarOpen: boolean;
};

export function CommunityWorkspaceContent({
  activeChannelId,
  activeCommunity,
  animateSidePanelEntries,
  callControls,
  channelUnreadCounts,
  communityRealtimeEvent,
  communityTypingIdentityIds,
  error,
  invitationAccepting,
  invitationError,
  invitationInviterName,
  loading,
  membersOpen,
  nodeNetworks,
  notificationSettingsByScopeKey,
  onChannelSelected,
  onChannelViewed,
  onCommunityChannelsUpdated,
  onCommunityLeft,
  onCommunityUpdated,
  onInvitationAccept,
  onLogout,
  onMembersClose,
  onMembersOpen,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  onOpenConversationWithIdentity,
  onPresenceChange,
  onPresenceStatusSelected,
  onRealtimeEventsOpen,
  onSessionUpdated,
  onSidebarClose,
  onSidebarOpen,
  pendingInvitation,
  presenceByIdentityId,
  railProps,
  realtimeStatus,
  sendCommunityTyping,
  session,
  sidebarOpen,
}: CommunityWorkspaceContentProps): ReactElement {
  if (loading && !activeCommunity) {
    return <CommunityWorkspaceStartupFallback />;
  }

  if (!activeCommunity) {
    return (
      <div className="glass-panel-strong col-span-3 flex h-full flex-col justify-center rounded-none p-4 text-center text-sm text-white/55">
        {error?.message ?? copy.communities.empty}
      </div>
    );
  }

  return (
    <Suspense fallback={<CommunityWorkspaceStartupFallback />}>
      <CommunityWorkspace
        key={activeCommunity.id}
        activeCall={callControls.activeCall}
        activeChannelId={activeChannelId}
        animateSidePanelEntries={animateSidePanelEntries}
        channelUnreadCounts={channelUnreadCounts}
        community={activeCommunity}
        invitationAccepting={invitationAccepting}
        invitationError={invitationError}
        invitationInviterName={invitationInviterName}
        mobileMembersOpen={membersOpen}
        mobileRail={
          <Rail
            {...railProps}
            onInspectorClick={() => {
              onSidebarClose();
              onMembersOpen();
            }}
          />
        }
        mobileSidebarOpen={sidebarOpen}
        nodeNetworks={nodeNetworks}
        notificationSettingsByScopeKey={notificationSettingsByScopeKey}
        onCallEnd={callControls.leaveActiveCall}
        onCallParticipantScreenShareVolumeChange={
          callControls.setParticipantScreenShareVolume
        }
        onCallParticipantVolumeChange={callControls.setParticipantVolume}
        onCallRetryMicrophone={callControls.retryMicrophone}
        onCallScreenShareQualityChange={callControls.setScreenShareQuality}
        onCallToggleCamera={callControls.toggleCamera}
        onCallToggleDeafen={callControls.toggleDeafen}
        onCallToggleMediaEncryption={callControls.toggleCallMediaEncryption}
        onCallToggleMute={callControls.toggleMute}
        onCallToggleNoiseCancellation={callControls.toggleCallNoiseCancellation}
        onCallToggleScreenShare={callControls.toggleScreenShare}
        onChannelSelected={(channelId) =>
          onChannelSelected(activeCommunity.id, channelId)
        }
        onChannelViewed={(channelId) =>
          onChannelViewed(activeCommunity.id, channelId)
        }
        onCommunityChannelsUpdated={onCommunityChannelsUpdated}
        onCommunityLeft={onCommunityLeft}
        onCommunityUpdated={onCommunityUpdated}
        onInvitationAccept={onInvitationAccept}
        onJoinVoiceChannel={callControls.startCommunityVoiceCall}
        onLogout={onLogout}
        onMobileMembersClose={onMembersClose}
        onMobileSidebarClose={onSidebarClose}
        onNotificationMuteToggle={onNotificationMuteToggle}
        onNotificationSettingsOpen={onNotificationSettingsOpen}
        onOpenConversationWithIdentity={(identityId, identity) =>
          onOpenConversationWithIdentity(
            identityId,
            identity,
            activeCommunity.networkId,
          )
        }
        onOpenMobileSidebar={onSidebarOpen}
        onPresenceChange={onPresenceChange}
        onPresenceStatusSelected={onPresenceStatusSelected}
        onRealtimeEventsOpen={onRealtimeEventsOpen}
        onSessionUpdated={onSessionUpdated}
        onTypingActive={sendCommunityTyping}
        pendingInvitation={pendingInvitation}
        presenceByIdentityId={presenceByIdentityId}
        realtimeEvent={communityRealtimeEvent}
        realtimeStatus={realtimeStatus}
        session={session}
        timelineFocusKey={`community:${activeCommunity.id}:${activeChannelId ?? ''}`}
        typingIdentityIds={communityTypingIdentityIds}
      />
    </Suspense>
  );
}
