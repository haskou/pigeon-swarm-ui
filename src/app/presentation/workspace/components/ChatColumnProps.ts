import type { RefObject } from 'react';

import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  ConversationInvitationNotificationResource,
  ConversationKeyEntry,
  ConversationResource,
  IdentityPresence,
  IdentityResource,
  NotificationScopeSetting,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
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
  hasReachedMessageStart: boolean;
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
