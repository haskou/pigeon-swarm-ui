import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';
import type { ConversationThreadState } from './conversationThreadState';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { MessageReactionUpdater } from '../../../../contexts/messages/presentation/view-models/MessageReactionUpdater';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';
import { showPwaNotification } from '../../../../contexts/notifications/presentation/services/pwaNotifications';
import { conversationNotificationPreview } from '../../../../contexts/notifications/presentation/view-models/notificationPreviews';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationRealtimeEvent } from './ConversationRealtimeEvent';
import { conversationRealtimeTimelineMessageKind } from './conversationRealtimeTimelineMessage';
import {
  mergeConversationMessageIfTargetExists,
  mergeConversationThreadMessage,
  removeConversationThreadMessage,
} from './conversationThreadState';
import { isBrowserPageVisible } from './isBrowserPageVisible';
import {
  eventAggregateId,
  recordAttribute,
  stringAttribute,
} from './realtimeEventAttributes';
import { notificationMentionContext } from './workspaceNotificationState';

type WorkspaceMode = 'community' | 'messages';

const conversationMessageEventDetails = (event: RealtimeDomainEvent) => {
  const conversationId = eventAggregateId(event);
  const messageId = stringAttribute(event, 'messageId', 'message_id');
  const timelineMessage = recordAttribute(event, 'message') as
    | MessageResource
    | undefined;

  if (!conversationId || (!messageId && !timelineMessage)) return null;

  return { conversationId, messageId, timelineMessage };
};

type RealtimeConversationEventsInput = {
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
  setConversationThread: Dispatch<
    SetStateAction<ConversationThreadState | null>
  >;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  setPinnedMessageIds: Dispatch<SetStateAction<Set<string>>>;
  workspaceMode: WorkspaceMode;
};

export function useWorkspaceRealtimeConversationEvents({
  activeConversationId,
  activeConversationKeyId,
  clearUnreadMessages,
  conversations,
  identityNames,
  identityProfiles,
  isScrolledNearBottom,
  markConversationReadUntil,
  markUnreadMessage,
  messagesRef,
  notificationSettingsRef,
  onErrorChange,
  onNotificationSound,
  refreshConversations,
  scrollMessagesToBottom,
  session,
  setConversations,
  setConversationThread,
  setMessages,
  setNewMessageCount,
  setPinnedMessageIds,
  workspaceMode,
}: RealtimeConversationEventsInput): (event: RealtimeDomainEvent) => boolean {
  const mergeMessage = useCallback(
    (message: ChatMessage) => {
      const isEdit = message.raw.type === 'edited';
      const isThreadReply = ThreadMessageVisibility.isThreadMessage(message);

      if (isThreadReply || isEdit) {
        setConversationThread((current) =>
          current ? mergeConversationThreadMessage(current, message) : current,
        );
      }

      if (!isThreadReply) {
        setMessages((current) =>
          isEdit
            ? mergeConversationMessageIfTargetExists(current, message)
            : MessageCollection.merge(current, [message]),
        );
      }
    },
    [setConversationThread, setMessages],
  );

  const updateMessageViewport = useCallback(
    (
      conversationId: string,
      message: ChatMessage,
      shouldAutoScroll: boolean,
    ) => {
      const isEdit = message.raw.type === 'edited';
      const isThreadReply = ThreadMessageVisibility.isThreadMessage(message);

      if (shouldAutoScroll) {
        markConversationReadUntil(conversationId, [message]);

        if (!isThreadReply) scrollMessagesToBottom('smooth', true);

        return;
      }

      const setting = NotificationSettingsPolicy.resolve(
        notificationSettingsRef.current,
        { conversationId, type: 'conversation' },
      );

      if (
        !isEdit &&
        !isThreadReply &&
        !NotificationSettingsPolicy.isMuted(setting)
      ) {
        setNewMessageCount((current) => current + 1);
      }
    },
    [
      markConversationReadUntil,
      notificationSettingsRef,
      scrollMessagesToBottom,
      setNewMessageCount,
    ],
  );

  const applyMessage = useCallback(
    (
      conversationId: string,
      message: ChatMessage,
      shouldAutoScroll: boolean,
    ) => {
      mergeMessage(message);
      updateMessageViewport(conversationId, message, shouldAutoScroll);
    },
    [mergeMessage, updateMessageViewport],
  );

  const fetchMessage = useCallback(
    async (
      conversationId: string,
      messageId: string,
      shouldAutoScroll: boolean,
    ) => {
      try {
        const message = await applicationContainer.messages.loadOne(
          session,
          conversationId,
          messageId,
        );

        if (message) applyMessage(conversationId, message, shouldAutoScroll);
      } catch (caught) {
        onErrorChange(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );
      }
    },
    [applyMessage, onErrorChange, session],
  );

  const removeMessage = useCallback(
    (event: RealtimeDomainEvent): boolean => {
      const targetMessageId = stringAttribute(
        event,
        'targetMessageId',
        'target_message_id',
      );

      if (!targetMessageId) return true;

      setMessages((current) =>
        current.filter((message) => message.id !== targetMessageId),
      );
      setConversationThread((current) =>
        current
          ? removeConversationThreadMessage(current, targetMessageId)
          : current,
      );

      return true;
    },
    [setConversationThread, setMessages],
  );

  const updateReaction = useCallback(
    (event: RealtimeDomainEvent, messageId: string): boolean => {
      const authorId = stringAttribute(
        event,
        'authorId',
        'authorIdentityId',
        'author_id',
      );
      const emoji = stringAttribute(event, 'emoji');

      if (!authorId || !emoji) return true;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? MessageReactionUpdater.update(
                message,
                authorId,
                emoji,
                event.type.endsWith('.was_added') ? 'add' : 'remove',
                typeof event.attributes.createdAt === 'number'
                  ? event.attributes.createdAt
                  : event.occurred_on,
              )
            : message,
        ),
      );

      return true;
    },
    [setMessages],
  );

  const updatePin = useCallback(
    (event: RealtimeDomainEvent, messageId: string): boolean => {
      setPinnedMessageIds((current) => {
        const next = new Set(current);

        if (event.type.endsWith('.was_pinned')) next.add(messageId);
        else next.delete(messageId);

        return next;
      });

      return true;
    },
    [setPinnedMessageIds],
  );

  const mergeCallEvent = useCallback(
    (
      event: RealtimeDomainEvent,
      message: MessageResource,
      shouldAutoScroll: boolean,
    ): boolean => {
      const chatMessage: ChatMessage = {
        attachments: [],
        authorIdentityId:
          message.actorIdentityId ?? message.authorIdentityId ?? 'system',
        content: '',
        encrypted: false,
        id: message.id ?? `${event.event_id}:call-event`,
        kind: 'call-event',
        mine: message.actorIdentityId === session.identity.id,
        raw: message,
        reactions: message.reactions ?? [],
        timestamp: message.createdAt ?? event.occurred_on,
      };

      setMessages((current) => MessageCollection.merge(current, [chatMessage]));

      if (shouldAutoScroll) scrollMessagesToBottom('smooth', true);

      return true;
    },
    [scrollMessagesToBottom, session.identity.id, setMessages],
  );

  const mergeTimelineMessage = useCallback(
    (
      event: RealtimeDomainEvent,
      conversationId: string,
      messageId: string | undefined,
      timelineMessage: MessageResource,
    ): boolean => {
      const shouldAutoScroll = isScrolledNearBottom();

      if (
        conversationRealtimeTimelineMessageKind(event.type) === 'call-event'
      ) {
        return mergeCallEvent(event, timelineMessage, shouldAutoScroll);
      }

      if (!activeConversationKeyId) return true;

      void applicationContainer.messages
        .decrypt(session, conversationId, timelineMessage)
        .then((message) =>
          applyMessage(conversationId, message, shouldAutoScroll),
        )
        .catch(() => {
          const fallbackMessageId = messageId ?? timelineMessage.id;

          if (fallbackMessageId) {
            void fetchMessage(
              conversationId,
              fallbackMessageId,
              shouldAutoScroll,
            );
          }
        });

      return true;
    },
    [
      activeConversationKeyId,
      applyMessage,
      fetchMessage,
      isScrolledNearBottom,
      mergeCallEvent,
      session,
    ],
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
        authorId === session.identity.id ||
        timelineMessage?.actorIdentityId === session.identity.id
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

  const fetchUnknownMessage = useCallback(
    (conversationId: string, messageId: string | undefined): boolean => {
      const alreadyLoaded = messageId
        ? messagesRef.current.some((message) => message.id === messageId)
        : false;

      if (!activeConversationKeyId || !messageId || alreadyLoaded) return true;

      void fetchMessage(conversationId, messageId, isScrolledNearBottom());

      return true;
    },
    [activeConversationKeyId, fetchMessage, isScrolledNearBottom, messagesRef],
  );

  const handleSelectedMessageEvent = useCallback(
    (
      event: RealtimeDomainEvent,
      conversationId: string,
      messageId: string | undefined,
      timelineMessage: MessageResource | undefined,
    ): boolean => {
      const handlers = {
        delete: () => removeMessage(event),
        fetch: () => fetchUnknownMessage(conversationId, messageId),
        pin: () => (messageId ? updatePin(event, messageId) : true),
        reaction: () => (messageId ? updateReaction(event, messageId) : true),
        timeline: () =>
          timelineMessage
            ? mergeTimelineMessage(
                event,
                conversationId,
                messageId,
                timelineMessage,
              )
            : true,
      };
      const projection = ConversationRealtimeEvent.projection(
        event,
        Boolean(timelineMessage),
      );

      return handlers[projection]();
    },
    [
      fetchUnknownMessage,
      mergeTimelineMessage,
      removeMessage,
      updatePin,
      updateReaction,
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
      const selected =
        workspaceMode === 'messages' && conversationId === activeConversationId;
      const active = selected && isBrowserPageVisible();

      if (!active && ConversationRealtimeEvent.shouldNotify(event)) {
        notify(event, conversationId, messageId, timelineMessage);
      }

      if (!selected) return true;

      if (active) clearUnreadMessages(conversationId);

      return handleSelectedMessageEvent(
        event,
        conversationId,
        messageId,
        timelineMessage,
      );
    },
    [
      activeConversationId,
      clearUnreadMessages,
      handleSelectedMessageEvent,
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

      if (!conversationId || readerIdentityId !== session.identity.id) {
        return true;
      }

      clearUnreadMessages(conversationId);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );

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
