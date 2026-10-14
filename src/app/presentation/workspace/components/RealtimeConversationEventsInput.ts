import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type { WorkspaceMode } from './WorkspaceMode';

export type RealtimeConversationEventsInput = {
  activeConversationId: null | string;
  clearUnreadMessages: (conversationId: string) => void;
  conversations: ConversationResource[];
  identityNames: Record<string, string>;
  identityProfiles: Record<string, IdentityResource>;
  isScrolledNearBottom: () => boolean;
  markUnreadMessage: (conversationId: string, messageId: string) => void;
  notificationSettingsRef: RefObject<NotificationSettingMap>;
  onNotificationSound: () => void;
  refreshConversations: () => Promise<ConversationResource[]>;
  scrollMessagesToBottom: (
    behavior?: ScrollBehavior,
    keepPinned?: boolean,
  ) => void;
  session: Session;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  workspaceMode: WorkspaceMode;
};
