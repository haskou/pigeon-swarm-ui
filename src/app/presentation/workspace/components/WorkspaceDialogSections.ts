import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { NodeInfo } from '../../../../contexts/networks/infrastructure/http/NodeInfo';
import type { NetworkSynchronizationStatus } from '../../../../contexts/networks/presentation/view-models/NetworkSynchronizationStatus';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { Peer } from '../../../../contexts/networks/presentation/view-models/Peer';
import type { NotificationScopeSettingsTarget } from '../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog';
import type {
  ChatMessage,
  Community,
  CommunityMembershipRequest,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  MessageAttachment,
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { MessageContextMenuState } from './messageContextMenu';

export type WorkspaceInspectorDialog = {
  activeConversation?: ConversationResource;
  activeConversationPeerIdentityId?: string;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  nodeNetworks: NodeNetwork[];
  onClose: () => void;
  onGroupInviteOpen: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  open: boolean;
  presenceByIdentityId: Record<string, IdentityPresence>;
  session: Session;
};

export type WorkspaceMessageActionDialogs = {
  activeConversation?: ConversationResource;
  menu: MessageContextMenuState | null;
  onCloseMenu: () => void;
  onCloseRawMessage: () => void;
  onCopy: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onDownloadAttachment: (attachment: MessageAttachment) => void;
  onEdit: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onUnpin: (message: ChatMessage) => void;
  onViewRaw: (message: ChatMessage) => void;
  pinnedMessageIds: ReadonlySet<string>;
  rawMessage: ChatMessage | null;
  session: Session;
};

export type WorkspaceCreationDialogs = {
  conversations: ConversationResource[];
  createCommunityOpen: boolean;
  createConversationOpen: boolean;
  nodeNetworks: NodeNetwork[];
  onCloseCommunity: () => void;
  onCloseConversation: () => void;
  onCommunityCreated: (input: {
    community: Community;
    session: Session;
  }) => void;
  onCommunityJoinRequested: (request: CommunityMembershipRequest) => void;
  onConversationCreated: (
    nextSession: Session,
    conversation: ConversationResource,
  ) => void;
  session: Session;
};

export type WorkspaceNotificationsDialog = {
  action: 'accept' | 'archive' | 'decline' | 'refresh' | null;
  archive: (notificationId: string) => void;
  communities: Community[];
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
  conversations: ConversationResource[];
  error: string | null;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  membershipAction: 'accept' | 'decline' | 'refresh' | null;
  membershipError: string | null;
  membershipRequests: CommunityMembershipRequest[];
  nodeNetworks: NodeNetwork[];
  notifications: NotificationResource[];
  onAccept: (notification: NotificationResource) => void;
  onAcceptMembershipRequest: (requestId: string) => void;
  onClose: () => void;
  onDecline: (notificationId: string) => void;
  onDeclineMembershipRequest: (requestId: string) => void;
  open: boolean;
  session: Session;
};

export type WorkspaceNotificationSettingsDialog = {
  error: null | string;
  onClose: () => void;
  onReset: (scope: NotificationScopeSettingsTarget['scope']) => void;
  onSave: (setting: NotificationScopeSettingInput) => void;
  setting: NotificationScopeSetting | null;
  target: NotificationScopeSettingsTarget | null;
};

export type WorkspaceNodeSettingsDialog = {
  networkSynchronizationStatus: NetworkSynchronizationStatus | null;
  networks: NodeNetwork[];
  node: (NodeInfo & { owner: null | string }) | null;
  onClose: () => void;
  onNetworksUpdated: () => Promise<void>;
  open: boolean;
  peers: Peer[];
  peersLoading: boolean;
  session: Session;
};

export type WorkspaceRealtimeEventsDialog = {
  events: RealtimeDomainEvent[];
  onClose: () => void;
  open: boolean;
};

export type WorkspaceIncomingCallDialog = {
  incomingCall: {
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null;
  onAccept: () => void;
  onDecline: () => void;
};

export type WorkspaceDialogSections = {
  creation: WorkspaceCreationDialogs;
  incomingCall: WorkspaceIncomingCallDialog;
  inspector: WorkspaceInspectorDialog;
  messageActions: WorkspaceMessageActionDialogs;
  nodeSettings: WorkspaceNodeSettingsDialog;
  notificationSettings: WorkspaceNotificationSettingsDialog;
  notifications: WorkspaceNotificationsDialog;
  realtimeEvents: WorkspaceRealtimeEventsDialog;
};
