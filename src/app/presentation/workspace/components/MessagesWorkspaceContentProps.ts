import type { AttachmentProgress } from '../../../../contexts/attachments/application/contracts/AttachmentProgress';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ConversationWithUnread } from '../../../../contexts/conversations/presentation/view-models/ConversationWithUnread';
import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { SelectablePresenceStatusResource as SelectablePresenceStatus } from '../../../../contexts/identities/infrastructure/http/resources/SelectablePresenceStatusResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingResource';
import type { ChatColumn } from './ChatColumn';
import type { ConversationPollsController } from './ConversationPollsController';
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
    | 'retryConnection'
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
  conversationTypingIdentityIds: string[];
  conversationsWithUnread: ConversationWithUnread[];
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
  onConversationsChanged: Parameters<
    typeof ChatColumn
  >[0]['onConversationsChanged'];
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
  onPresenceSharingToggle: (
    conversationId: string,
    contactIdentityId: string,
  ) => void;
  onPresenceStatusSelected: (status: SelectablePresenceStatus) => void;
  onRealtimeEventsOpen: () => void;
  onSessionUpdated: (session: Session) => void;
  onSidebarClose: () => void;
  onSidebarOpen: () => void;
  pendingInvitation: Parameters<typeof ChatColumn>[0]['pendingInvitation'];
  pins: ReturnType<typeof useConversationPins>;
  polls: ConversationPollsController;
  presenceByIdentityId: Record<string, IdentityPresence>;
  presenceSharedConversationIds: ReadonlySet<string>;
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
