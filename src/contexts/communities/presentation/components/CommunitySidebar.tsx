import type { MouseEvent, ReactNode } from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type { CallSession } from '../../../calls/domain/callSession.types';
import type {
  Community,
  CommunityChannelThreadSummary,
  CommunityTextChannel,
  CommunityVoiceChannel,
  IdentityPresence,
  NotificationScopeSetting,
  Session,
  SelectablePresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { UserProfileDropdown } from '../../../../app/presentation/workspace/components/UserProfileDropdown';
import { CommunityChannelList } from './CommunityChannelList';
import type { VoiceParticipantView } from './VoiceParticipantView';

type CommunitySidebarProps = {
  activeCall?: CallSession | null;
  activeVoiceChannelId: null | string;
  animateEntries?: boolean;
  animationScopeKey?: string;
  bannerUrl: null | string;
  canManageCommunity: boolean;
  channelSearch: string;
  channelUnreadCounts: Record<string, number>;
  community: Community;
  communityIsPublic: boolean;
  mobileRail?: ReactNode;
  mobileSidebarOpen: boolean;
  nodeNetworks: NodeNetwork[];
  onBannerOpen: () => void;
  onCallEnd?: () => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallRetryMicrophone?: () => void;
  onCallScreenShareQualityChange?: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMicrophone?: () => void;
  onCallToggleMediaEncryption?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallToggleScreenShare?: () => void;
  onChannelSearchChange: (value: string) => void;
  onManageOpen: () => void;
  onMobileSidebarClose: () => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  onSessionUpdated: (session: Session) => void;
  onTextChannelMuteToggle: (channel: CommunityTextChannel) => void;
  onTextChannelNotificationSettingsOpen: (
    channel: CommunityTextChannel,
  ) => void;
  onTextChannelSelected: (channelId: string) => void;
  onThreadSelected: (
    channel: CommunityTextChannel,
    thread: CommunityChannelThreadSummary,
  ) => void;
  onLogout: () => void;
  onVoiceChannelJoin: (channel: CommunityVoiceChannel) => void;
  onVoiceParticipantClick: (
    participant: VoiceParticipantView,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  ownIdentityPictures: Record<string, string>;
  presence: IdentityPresence | undefined;
  selectedChannelId: null | string;
  selectedThreadRootMessageId?: null | string;
  session: Session;
  textChannelNotificationSetting: (
    channel: CommunityTextChannel,
  ) => NotificationScopeSetting;
  textChannels: CommunityTextChannel[];
  threadLabelByRootMessageId: Record<string, string>;
  visibleTextChannels: CommunityTextChannel[];
  visibleVoiceChannels: CommunityVoiceChannel[];
  voiceChannelNotificationSetting: (
    channel: CommunityVoiceChannel,
  ) => NotificationScopeSetting;
  voiceChannels: CommunityVoiceChannel[];
  voiceParticipantsByChannelId: Map<string, VoiceParticipantView[]>;
};

export function CommunitySidebar({
  activeCall,
  activeVoiceChannelId,
  animateEntries = true,
  animationScopeKey,
  bannerUrl,
  canManageCommunity,
  channelSearch,
  channelUnreadCounts,
  community,
  communityIsPublic,
  mobileRail,
  mobileSidebarOpen,
  nodeNetworks,
  onBannerOpen,
  onCallEnd,
  onCallParticipantScreenShareVolumeChange,
  onCallParticipantVolumeChange,
  onCallRetryMicrophone,
  onCallScreenShareQualityChange,
  onCallToggleCamera,
  onCallToggleDeafen,
  onCallToggleMicrophone,
  onCallToggleMediaEncryption,
  onCallToggleNoiseCancellation,
  onCallToggleScreenShare,
  onChannelSearchChange,
  onManageOpen,
  onMobileSidebarClose,
  onPresenceChange,
  onPresenceStatusSelected,
  onSessionUpdated,
  onTextChannelMuteToggle,
  onTextChannelNotificationSettingsOpen,
  onTextChannelSelected,
  onThreadSelected,
  onLogout,
  onVoiceChannelJoin,
  onVoiceParticipantClick,
  ownIdentityPictures,
  presence,
  selectedChannelId,
  selectedThreadRootMessageId,
  session,
  textChannelNotificationSetting,
  textChannels,
  threadLabelByRootMessageId,
  visibleTextChannels,
  visibleVoiceChannels,
  voiceChannelNotificationSetting,
  voiceChannels,
  voiceParticipantsByChannelId,
}: CommunitySidebarProps) {
  return (
    <>
      <button
        className={cx(
          'fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 lg:hidden',
          mobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onMobileSidebarClose}
        aria-label={copy.workspace.closeSidebar}
      />
      <aside
        className={cx(
          'app-safe-area-drawer-until-lg app-safe-area-drawer-flush fixed inset-y-0 left-0 z-40 block w-[92vw] max-w-[430px] p-0 transition-transform duration-200 ease-out sm:w-[calc(86vw+82px)] sm:max-w-[442px] lg:static lg:z-auto lg:block lg:w-auto lg:max-w-none lg:translate-x-0',
          mobileSidebarOpen
            ? 'translate-x-0'
            : 'pointer-events-none -translate-x-full lg:pointer-events-auto',
        )}
      >
        <div className="grid h-full grid-cols-[82px_minmax(0,1fr)] gap-0 lg:block">
          <div className="lg:hidden">{mobileRail}</div>
          <div className="ui-sidebar flex h-full min-h-0 flex-col p-4">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
                {communityIsPublic
                  ? copy.communities.publicCommunity
                  : copy.communities.privateCommunity}
              </div>
              <div className="mt-3 overflow-hidden border-y border-white/10 text-left">
                {bannerUrl ? (
                  <button
                    type="button"
                    onClick={onBannerOpen}
                    className="grid h-32 w-full place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950 transition hover:brightness-110"
                    aria-label={copy.communities.openBanner}
                  >
                    <img
                      src={bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="grid h-32 place-items-center overflow-hidden bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-5xl font-black text-slate-950">
                    {community.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="py-3">
                  <h2 className="truncate text-lg font-black">
                    {community.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/55">
                    {community.description}
                  </p>
                  {canManageCommunity && (
                    <button
                      type="button"
                      onClick={onManageOpen}
                      className="ui-button ui-button-primary mt-3 w-full"
                    >
                      {copy.communities.manage}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <CommunityChannelList
              activeVoiceChannelId={activeVoiceChannelId}
              animateEntries={animateEntries}
              animationScopeKey={animationScopeKey}
              channelSearch={channelSearch}
              channelUnreadCounts={channelUnreadCounts}
              onChannelSearchChange={onChannelSearchChange}
              onTextChannelSelected={onTextChannelSelected}
              onTextChannelMuteToggle={onTextChannelMuteToggle}
              onTextChannelNotificationSettingsOpen={
                onTextChannelNotificationSettingsOpen
              }
              onThreadSelected={onThreadSelected}
              onVoiceChannelJoin={onVoiceChannelJoin}
              onVoiceParticipantClick={onVoiceParticipantClick}
              selectedChannelId={selectedChannelId}
              selectedThreadRootMessageId={selectedThreadRootMessageId}
              textChannels={textChannels}
              textChannelNotificationSetting={textChannelNotificationSetting}
              threadLabelByRootMessageId={threadLabelByRootMessageId}
              visibleTextChannels={visibleTextChannels}
              visibleVoiceChannels={visibleVoiceChannels}
              voiceChannelNotificationSetting={voiceChannelNotificationSetting}
              voiceChannels={voiceChannels}
              voiceParticipantsByChannelId={voiceParticipantsByChannelId}
            />
            <UserProfileDropdown
              activeCall={activeCall}
              identityPictures={ownIdentityPictures}
              nodeNetworks={nodeNetworks}
              onPresenceChange={onPresenceChange}
              onPresenceStatusSelected={onPresenceStatusSelected}
              onCallEnd={onCallEnd}
              onCallParticipantScreenShareVolumeChange={
                onCallParticipantScreenShareVolumeChange
              }
              onCallParticipantVolumeChange={onCallParticipantVolumeChange}
              onCallScreenShareQualityChange={onCallScreenShareQualityChange}
              onCallToggleCamera={onCallToggleCamera}
              onCallToggleDeafen={onCallToggleDeafen}
              onCallToggleMute={onCallToggleMicrophone}
              onCallToggleMediaEncryption={onCallToggleMediaEncryption}
              onCallToggleNoiseCancellation={onCallToggleNoiseCancellation}
              onCallRetryMicrophone={onCallRetryMicrophone}
              onCallToggleScreenShare={onCallToggleScreenShare}
              onLogout={onLogout}
              onSessionUpdated={onSessionUpdated}
              presence={presence}
              session={session}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
