import { useCallback } from 'react';

import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { MessageResource } from '../../../../contexts/messages/infrastructure/http/MessageResource';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { RealtimeConversationEventsInput } from './RealtimeConversationEventsInput';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
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

const callEventDetails = (event: RealtimeDomainEvent) => {
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

  const handleCallEvent = useCallback(
    (event: RealtimeDomainEvent): boolean => {
      void refreshConversations().catch(() => undefined);
      const details = callEventDetails(event);

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

      if (!active) notify(event, conversationId, messageId, timelineMessage);

      if (!selected) return true;

      if (active) clearUnreadMessages(conversationId);

      if (timelineMessage) {
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

  /**
   * Messages, reactions, pins and read state never come from the node: they
   * arrive through the mailbox syncs. Only conversation lifecycle changes and
   * recorded call events are handled here.
   */
  return useCallback(
    (event: RealtimeDomainEvent): boolean => {
      if (ConversationRealtimeEvent.isConversationLifecycle(event)) {
        void refreshConversations().catch(() => undefined);

        return true;
      }

      if (ConversationRealtimeEvent.isCallEvent(event)) {
        return handleCallEvent(event);
      }

      return false;
    },
    [handleCallEvent, refreshConversations],
  );
}
