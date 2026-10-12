import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ConversationThread } from './ConversationThread';
import type { WorkspaceMode } from './WorkspaceMode';

export type RealtimeConversationEventsInput = {
  activeConversationId: null | string;
  activeConversationKeyId: null | string;
  clearUnreadMessages: (conversationId: string) => void;
  conversations: ConversationResource[];
  identityNames: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  isScrolledNearBottom: () => boolean;
  markConversationReadUntil: (
    conversationId: string,
    messages: ChatMessage[],
  ) => void;
  markUnreadMessage: (conversationId: string, messageId: string) => void;
  messagesRef: RefObject<ChatMessage[]>;
  notificationSettingsRef: RefObject<NotificationSettingMap>;
  onErrorChange: (error: string | null) => void;
  onNotificationSound: () => void;
  refreshConversations: () => Promise<ConversationResource[]>;
  scrollMessagesToBottom: (
    behavior?: ScrollBehavior,
    keepPinned?: boolean,
  ) => void;
  session: Session;
  setConversationThread: Dispatch<SetStateAction<ConversationThread | null>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
  workspaceMode: WorkspaceMode;
};
