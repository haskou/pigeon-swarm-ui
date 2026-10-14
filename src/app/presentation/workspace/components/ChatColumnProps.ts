import type { RefObject } from 'react';

import type { AttachmentProgress } from '../../../../contexts/attachments/application/contracts/AttachmentProgress';
import type { AttachmentUploadOptions } from '../../../../contexts/attachments/application/contracts/AttachmentUploadOptions';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityPresenceResource as IdentityPresence } from '../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { ConversationInvitationNotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/ConversationInvitationNotificationResource';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingResource';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

export interface ChatColumnProps {
  session: Session;
  activeConversation?: ConversationResource;
  peerIdentityId?: string;
  peerIdentity?: IdentityResource;
  peerPicture?: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  presenceByIdentityId?: Record<string, IdentityPresence>;
  conversationKey?: ConversationKeyEntry;
  draft: string;
  editingMessage?: ChatMessage | null;
  hasConversationKey: boolean;
  invitationAccepting?: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  messages: ChatMessage[];
  messageState: 'idle' | 'loading' | 'error';
  nodeNetworks: NodeNetwork[];
  pinnedMessageIds: ReadonlySet<string>;
  sendError: string | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  newMessageCount: number;
  onScroll: () => void;
  onSend: (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => Promise<void>;
  onEditMessage: (content: string) => Promise<void>;
  onStickerSend: (sticker: StickerMessageReference) => Promise<void>;
  onConversationKeyImported: (keyEntry: ConversationKeyEntry) => Promise<void>;
  onConversationsChanged: () => Promise<unknown>;
  onInvitationAccept?: (
    notification: ConversationInvitationNotificationResource,
  ) => void;
  onDraftChange: (value: string) => void;
  onEscape: () => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onOpenMessageThread: (message: ChatMessage) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onOpenSidebar: () => void;
  onOpenPins: () => void;
  groupInviteRequest?: number;
  notificationSetting: NotificationScopeSetting;
  onCreate: () => void;
  onOpenConversationWithIdentity?: (
    identityId: string,
    identity?: IdentityResource,
  ) => Promise<void>;
  onNotificationSettingsOpen: (input: {
    scope: NotificationScopeSetting['scope'];
    subtitle?: string;
    title: string;
  }) => void;
  onNotificationMuteToggle: (scope: NotificationScopeSetting['scope']) => void;
  onRealtimeEventsOpen?: () => void;
  progress?: AttachmentProgress | null;
  realtimeStatus?: 'connected' | 'reconnecting';
  onCancelEdit: () => void;
  replyToMessage?: ChatMessage | null;
  onCancelReply: () => void;
  onStartCall?: (input: {
    conversationId: string;
    kind: 'group' | 'one-to-one';
    participants: CallParticipant[];
    title: string;
  }) => void;
  onTypingActive?: (active: boolean) => void;
  pendingInvitation?: ConversationInvitationNotificationResource | null;
  realtimeEvent?: RealtimeDomainEvent | null;
  typingIdentityIds?: string[];
}
