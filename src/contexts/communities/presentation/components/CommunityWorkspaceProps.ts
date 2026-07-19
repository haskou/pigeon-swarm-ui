import type { ReactNode } from 'react';

import type {
  Community,
  CommunityChannel,
  CommunityInvitationNotificationResource,
  CommunityVoiceChannel,
  IdentityPresence,
  IdentityResource,
  NotificationSettingScope,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { CallSession } from '../../../calls/presentation/view-models/CallSession';
import type { NodeNetwork } from '../../../networks/presentation/view-models/NodeNetwork';
import type { NotificationScopeSettingsTarget } from '../../../notifications/presentation/components/NotificationScopeSettingsDialog';
import type { NotificationSettingMap } from '../../../notifications/presentation/view-models/NotificationSettingMap';

export interface CommunityWorkspaceProps {
  activeChannelId?: null | string;
  activeCall?: CallSession | null;
  animateSidePanelEntries?: boolean;
  channelUnreadCounts?: Record<string, number>;
  community: Community;
  invitationAccepting?: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  timelineFocusKey?: string;
  mobileMembersOpen: boolean;
  mobileSidebarOpen: boolean;
  mobileRail?: ReactNode;
  nodeNetworks: NodeNetwork[];
  presenceByIdentityId?: Record<string, IdentityPresence>;
  onChannelSelected: (channelId: string) => void;
  onChannelViewed?: (channelId: string) => void;
  onCommunityLeft: (community: Community) => void;
  onCommunityChannelsUpdated: (
    communityId: string,
    channels: CommunityChannel[],
  ) => void;
  onCommunityUpdated: (community: Community) => void;
  onInvitationAccept?: (
    notification: CommunityInvitationNotificationResource,
  ) => void;
  notificationSettingsByScopeKey: NotificationSettingMap;
  onCallEnd?: () => void;
  onCallParticipantVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallParticipantScreenShareVolumeChange?: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onCallScreenShareQualityChange?: (
    quality: CallSession['screenShareQuality'],
  ) => void;
  onCallToggleCamera?: () => void;
  onCallToggleDeafen?: () => void;
  onCallToggleMute?: () => void;
  onCallToggleMediaEncryption?: () => void;
  onCallToggleNoiseCancellation?: () => void;
  onCallRetryMicrophone?: () => void;
  onCallToggleScreenShare?: () => void;
  onLogout: () => void;
  onPresenceChange?: (presence: IdentityPresence) => void;
  onPresenceStatusSelected?: (status: SelectablePresenceStatus) => void;
  onMobileMembersClose: () => void;
  onMobileSidebarClose: () => void;
  onOpenMobileSidebar: () => void;
  onNotificationSettingsOpen: (target: NotificationScopeSettingsTarget) => void;
  onNotificationMuteToggle: (scope: NotificationSettingScope) => void;
  onJoinVoiceChannel?: (channel: CommunityVoiceChannel) => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onRealtimeEventsOpen?: () => void;
  onSessionUpdated: (session: Session) => void;
  onTypingActive?: (channelId: string, active: boolean) => void;
  pendingInvitation?: CommunityInvitationNotificationResource | null;
  realtimeEvent?: null | RealtimeDomainEvent;
  realtimeStatus?: 'connected' | 'reconnecting';
  session: Session;
  typingIdentityIds?: string[];
}
