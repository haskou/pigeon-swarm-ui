import type {
  AttachmentProgress,
  ChatMessage,
  Community,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  NotificationScopeSetting,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { ChatColumn } from './ChatColumn';
import type { EditingMessage } from './conversationThreadState';
import type { RailProps } from './Rail';
import type { useConversationMessageActions } from './useConversationMessageActions';
import type { useConversationPins } from './useConversationPins';
import type { useConversationThread } from './useConversationThread';
import type { useConversationTimeline } from './useConversationTimeline';
import type { useWorkspaceCalls } from './useWorkspaceCalls';
import type { Sidebar } from './workspaceLazyComponents';

export type MessagesWorkspaceContentProps = {
  acceptInvitation: NonNullable<
    Parameters<typeof ChatColumn>[0]['onInvitationAccept']
  >;
  activeConversation?: ConversationResource;
  activeConversationDraft: string;
  activeConversationKey?: Session['keychain']['conversations'][string];
  activeConversationPeerIdentityId?: string;
  attachmentProgress: AttachmentProgress | null;
  callControls: Pick<
    ReturnType<typeof useWorkspaceCalls>,
    | 'activeCall'
    | 'leaveActiveCall'
    | 'retryMicrophone'
    | 'setParticipantScreenShareVolume'
    | 'setParticipantVolume'
    | 'setScreenShareQuality'
    | 'startConversationCall'
    | 'toggleCallMediaEncryption'
    | 'toggleCallNoiseCancellation'
    | 'toggleCamera'
    | 'toggleDeafen'
    | 'toggleMute'
    | 'toggleScreenShare'
  >;
  closeTransientUi: () => void;
  communities: Community[];
  conversationNotificationSetting: NotificationScopeSetting;
  conversationNotificationSettingFor: (
    conversation: ConversationResource,
  ) => NotificationScopeSetting;
  conversationRealtimeEvent: RealtimeDomainEvent | null;
  conversationTypingIdentityIds: string[];
  conversationsWithUnread: ConversationResource[];
  editingMessage: EditingMessage | null;
  groupInviteRequest: number;
  identityNames: Record<string, string>;
  identityPictures: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  invitationAccepting: boolean;
  invitationError: string | null;
  invitationInviterName?: string;
  messageActions: ReturnType<typeof useConversationMessageActions>;
  nodeNetworks: Parameters<typeof ChatColumn>[0]['nodeNetworks'];
  notificationMuteToggle: Parameters<
    typeof ChatColumn
  >[0]['onNotificationMuteToggle'];
  notificationSettingsOpen: Parameters<
    typeof ChatColumn
  >[0]['onNotificationSettingsOpen'];
  onConversationKeyImported: Parameters<
    typeof ChatColumn
  >[0]['onConversationKeyImported'];
  onConversationNotificationMuteToggle: Parameters<
    typeof Sidebar
  >[0]['onConversationNotificationMuteToggle'];
  onConversationNotificationSettingsOpen: Parameters<
    typeof Sidebar
  >[0]['onConversationNotificationSettingsOpen'];
  onConversationSelected: (conversationId: string) => void;
  onCreateConversation: () => void;
  onGroupInviteOpen: () => void;
  onInspectorOpen: () => void;
  onLogout: () => void;
  onOpenConversationWithIdentity: (
    identityId: string,
    identity?: IdentityResource,
    networkId?: string,
  ) => Promise<void>;
  onPresenceChange: (presence: IdentityPresence) => void;
  onPresenceStatusSelected: (status: SelectablePresenceStatus) => void;
  onRealtimeEventsOpen: () => void;
  onSessionUpdated: (session: Session) => void;
  onSidebarClose: () => void;
  onSidebarOpen: () => void;
  pendingInvitation: Parameters<typeof ChatColumn>[0]['pendingInvitation'];
  pins: ReturnType<typeof useConversationPins>;
  presenceByIdentityId: Record<string, IdentityPresence>;
  railProps: RailProps;
  realtimeStatus: 'connected' | 'reconnecting';
  replyTarget: ChatMessage | null;
  sendConversationTyping: NonNullable<
    Parameters<typeof ChatColumn>[0]['onTypingActive']
  >;
  sendError: string | null;
  session: Session;
  sidebarOpen: boolean;
  thread: ReturnType<typeof useConversationThread>;
  timeline: ReturnType<typeof useConversationTimeline>;
  updateActiveDraft: (draft: string) => void;
};
