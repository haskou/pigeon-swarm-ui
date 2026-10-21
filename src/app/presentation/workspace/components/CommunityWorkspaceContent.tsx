import { Suspense, type ReactElement } from 'react';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';
import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
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
    | 'retryConnection'
    | 'setParticipantScreenShareVolume'
    | 'setParticipantVolume'
    | 'setScreenShareQuality'
    | 'startCommunityVoiceCall'
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
  onCommunitiesRetry: () => void;
  onCommunityChannelsUpdated: Parameters<
    typeof CommunityWorkspace
  >[0]['onCommunityChannelsUpdated'];
  onCommunityLeft: (community: Community) => void;
  onCommunityUpdated: (community: Community) => void;
  /** Set while the list is not settled for a device that listed communities. */
  onContinueWithoutCommunities: (() => Promise<void>) | null;
  onInvitationAccept: (notification: NotificationResource) => void;
  onKeychainPublished: (
    identityId: string,
    published: Pick<Session, 'keychain' | 'keychainExternalIdentifier'>,
  ) => void;
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
  onCommunitiesRetry,
  onCommunityChannelsUpdated,
  onCommunityLeft,
  onCommunityUpdated,
  onContinueWithoutCommunities,
  onInvitationAccept,
  onKeychainPublished,
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
        {error ? (
          <div className="flex flex-col items-center gap-4">
            <p role="alert">{error.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onCommunitiesRetry}
                className="glass-button rounded-xl bg-fuchsia-500 px-5 py-2 text-sm font-black text-white"
              >
                {copy.communities.retryLoad}
              </button>
              {onContinueWithoutCommunities ? (
                <button
                  type="button"
                  onClick={() => void onContinueWithoutCommunities()}
                  className="glass-button rounded-xl px-5 py-2 text-sm font-black text-white"
                >
                  {copy.communities.continueWithoutCommunities}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          copy.communities.empty
        )}
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
        onCallRetryConnection={callControls.retryConnection}
        onCallScreenShareQualityChange={callControls.setScreenShareQuality}
        onCallToggleCamera={callControls.toggleCamera}
        onCallToggleDeafen={callControls.toggleDeafen}
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
        onKeychainPublished={onKeychainPublished}
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
