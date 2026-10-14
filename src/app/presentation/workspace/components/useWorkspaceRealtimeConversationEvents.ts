import { useCallback } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { MessageResource } from '../../../../contexts/messages/infrastructure/http/MessageResource';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { RealtimeConversationEventsInput } from './RealtimeConversationEventsInput';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { IdentityMatch } from '../../../../contexts/identities/presentation/view-models/IdentityMatch';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { showPwaNotification } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { conversationNotificationPreview } from '../../../../contexts/notifications/presentation/view-models/notificationPreviews';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { ConversationRealtimeEvent } from './ConversationRealtimeEvent';
import { isBrowserPageVisible } from './isBrowserPageVisible';
import {
  eventAggregateId,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { notificationMentionContext } from './workspaceNotificationState';

const conversationMessageEventDetails = (event: RealtimeDomainEvent) => {
  const conversationId = eventAggregateId(event);
  const messageId = stringAttribute(event, 'messageId', 'message_id');
  const timelineMessage = recordAttribute(event, 'message') as
    | MessageResource
    | undefined;

  if (!conversationId || (!messageId && !timelineMessage)) return null;

  return { conversationId, messageId, timelineMessage };
};

const conversationVisibility = (
  view: Pick<
    RealtimeConversationEventsInput,
    'activeConversationId' | 'workspaceMode'
  >,
  conversationId: string,
): { active: boolean; selected: boolean } => {
  const selected =
    view.workspaceMode === 'messages' &&
    conversationId === view.activeConversationId;

  return { active: selected && isBrowserPageVisible(), selected };
};

export function useWorkspaceRealtimeConversationEvents({
  activeConversationId,
  clearUnreadMessages,
  conversations,
  identityNames,
  identityProfiles,
  isScrolledNearBottom,
  markUnreadMessage,
  notificationSettingsRef,
  onNotificationSound,
  refreshConversations,
  scrollMessagesToBottom,
  session,
  setConversations,
  setMessages,
  workspaceMode,
}: RealtimeConversationEventsInput): (event: RealtimeDomainEvent) => boolean {
  const mergeCallEvent = useCallback(
    (
      event: RealtimeDomainEvent,
      message: MessageResource,
      shouldAutoScroll: boolean,
    ): void => {
      const chatMessage: ChatMessage = {
        attachments: [],
        authorIdentityId:
          message.actorIdentityId ?? message.authorIdentityId ?? 'system',
        content: '',
        encrypted: false,
        id: message.id ?? `${event.event_id}:call-event`,
        kind: 'call-event',
        mine: IdentityMatch.isSame(
          message.actorIdentityId,
          session.identity.id,
        ),
        raw: message,
        reactions: message.reactions ?? [],
        timestamp: message.createdAt ?? event.occurred_on,
      };

      setMessages((current) => MessageCollection.merge(current, [chatMessage]));

      if (shouldAutoScroll) scrollMessagesToBottom('smooth', true);
    },
    [scrollMessagesToBottom, session.identity.id, setMessages],
  );

  const notify = useCallback(
    (
      event: RealtimeDomainEvent,
      conversationId: string,
      messageId: string | undefined,
      timelineMessage: MessageResource | undefined,
    ) => {
      const authorId = stringAttribute(event, 'authorId', 'author_id');
      const setting = NotificationSettingsPolicy.resolve(
        notificationSettingsRef.current,
        { conversationId, type: 'conversation' },
      );
      const allowed = NotificationSettingsPolicy.shouldNotify(
        setting,
        notificationMentionContext({
          currentIdentityId: session.identity.id,
          event,
          message: timelineMessage,
        }),
      );

      if (
        !allowed ||
        IdentityMatch.isSame(authorId, session.identity.id) ||
        IdentityMatch.isSame(
          timelineMessage?.actorIdentityId,
          session.identity.id,
        )
      ) {
        return;
      }

      const preview = conversationNotificationPreview(
        conversations,
        conversationId,
        session,
        identityNames,
        identityProfiles,
        timelineMessage,
      );

      onNotificationSound();
      void showPwaNotification({
        body: preview.body,
        tag: `conversation:${conversationId}`,
        title: preview.title,
      });

      const unreadMessageId = messageId ?? timelineMessage?.id;

      if (unreadMessageId) markUnreadMessage(conversationId, unreadMessageId);
    },
    [
      conversations,
      identityNames,
      identityProfiles,
      markUnreadMessage,
      notificationSettingsRef,
      onNotificationSound,
      session,
    ],
  );

  const handleMessageEvent = useCallback(
    (event: RealtimeDomainEvent): boolean => {
      void refreshConversations().catch(() => undefined);
      const details = conversationMessageEventDetails(event);

      if (!details) return true;

      const { conversationId, messageId, timelineMessage } = details;

      setConversations((current) =>
        ConversationTimeline.bumpActivity(
          current,
          conversationId,
          event.occurred_on,
        ),
      );
      const { active, selected } = conversationVisibility(
        { activeConversationId, workspaceMode },
        conversationId,
      );

      if (!active && ConversationRealtimeEvent.shouldNotify(event)) {
        notify(event, conversationId, messageId, timelineMessage);
      }

      if (!selected) return true;

      if (active) clearUnreadMessages(conversationId);

      // Only call records still come from the node; group and one-to-one
      // messages arrive through their mailbox syncs.
      if (ConversationRealtimeEvent.isCallEvent(event) && timelineMessage) {
        mergeCallEvent(event, timelineMessage, isScrolledNearBottom());
      }

      return true;
    },
    [
      activeConversationId,
      clearUnreadMessages,
      isScrolledNearBottom,
      mergeCallEvent,
      notify,
      refreshConversations,
      setConversations,
      workspaceMode,
    ],
  );

  const handleReadReceipt = useCallback(
    (event: RealtimeDomainEvent): boolean => {
      const conversationId = eventAggregateId(event);
      const readerIdentityId = stringAttribute(
        event,
        'readerIdentityId',
        'reader_identity_id',
      );

      if (
        !conversationId ||
        !IdentityMatch.isSame(readerIdentityId, session.identity.id)
      ) {
        return true;
      }

      clearUnreadMessages(conversationId);
      const markConversationRead = (conversation: ConversationResource) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation;

      setConversations((current) => current.map(markConversationRead));

      return true;
    },
    [clearUnreadMessages, session.identity.id, setConversations],
  );

  return useCallback(
    (event: RealtimeDomainEvent): boolean => {
      if (ConversationRealtimeEvent.isConversationLifecycle(event)) {
        void refreshConversations().catch(() => undefined);

        return true;
      }

      if (ConversationRealtimeEvent.isMessageTimeline(event)) {
        return handleMessageEvent(event);
      }

      if (ConversationRealtimeEvent.isReadReceipt(event)) {
        return handleReadReceipt(event);
      }

      return false;
    },
    [handleMessageEvent, handleReadReceipt, refreshConversations],
  );
}
