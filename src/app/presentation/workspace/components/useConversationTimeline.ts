import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { ConversationMessageLoadState } from './ConversationMessageLoadState';
import type { ConversationTimelineController } from './ConversationTimelineController';
import type { UseConversationTimelineInput } from './UseConversationTimelineInput';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationTimelineLoadPlan } from './ConversationTimelineLoadPlan';
import { useMessageViewport } from './useMessageViewport';
import { useWorkspaceMessageHistory } from './useWorkspaceMessageHistory';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';

export function useConversationTimeline({
  activeConversation,
  activeConversationKey,
  clearUnreadMessages,
  onCommunitiesReload,
  onConversationsChange,
  onErrorChange,
  refreshConversations,
  sessionRef,
  suppressMessageLoadsUntilRef,
  workspaceMode,
}: UseConversationTimelineInput): ConversationTimelineController {
  const activeConversationId = activeConversation?.id;
  const activeConversationKeyAvailable = activeConversationKey !== undefined;
  const loadedConversationIdRef = useRef<null | string>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<null | string>(null);
  const [messageState, setMessageState] =
    useState<ConversationMessageLoadState>('loading');
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messageCursorRef = useRef<null | string>(null);
  const messageAbortRef = useRef<AbortController | null>(null);
  const messageRequestRef = useRef(0);
  const messageStateRef = useRef<ConversationMessageLoadState>('loading');
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeConversationRef = useRef(activeConversation);
  const clearNewMessageCount = useCallback((): void => {
    setNewMessageCount(0);
  }, []);
  const {
    bottomRef,
    isScrolledNearBottom,
    jumpToLatestMessages,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageScrollAnchorRef,
    scrollerRef,
    scrollMessagesToBottom,
  } = useMessageViewport({
    layoutKey: activeConversationId ?? null,
    messageCount: messages.length,
    messageState,
    onJumpToLatest: clearNewMessageCount,
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messageStateRef.current = messageState;
  }, [messageState]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const setMessageLoadState = useCallback(
    (state: ConversationMessageLoadState): void => {
      messageStateRef.current = state;
      setMessageState(state);
    },
    [],
  );
  const updateMessageCursor = useCallback((cursor: null | string): void => {
    messageCursorRef.current = cursor;
    setMessageCursor(cursor);
  }, []);
  const markConversationReadUntil = useCallback(
    (conversationId: string, loadedMessages: ChatMessage[]): void => {
      const lastMessage = MessageCollection.lastDelivered(loadedMessages);

      if (!lastMessage) return;

      clearUnreadMessages(conversationId);

      const clearConversationUnread = (conversation: ConversationResource) => {
        if (conversation.id !== conversationId) return conversation;

        return { ...conversation, unreadCount: 0 };
      };

      onConversationsChange((current) => current.map(clearConversationUnread));
      const readConversation = activeConversationRef.current;

      if (
        readConversation?.id === conversationId &&
        readConversation.type === 'one-to-one'
      ) {
        void applicationContainer.directMessages.markRead(
          sessionRef.current,
          readConversation,
          lastMessage.id,
        );

        return;
      }

      void applicationContainer.conversations
        .markReadUntil(sessionRef.current, conversationId, lastMessage.id)
        .catch(() => undefined);
    },
    [clearUnreadMessages, onConversationsChange, sessionRef],
  );
  /**
   * A one-to-one timeline comes only from its mailboxes: the mailbox sync
   * restores stored history and applies new records. Opening clears it on a
   * conversation switch and keeps it on a resume. Returns false for a group,
   * which still loads from the node.
   */
  const openDirectTimeline = useCallback(
    (conversationId: string): boolean => {
      const conversation = activeConversationRef.current;

      if (
        conversation?.id !== conversationId ||
        conversation.type !== 'one-to-one'
      ) {
        return false;
      }

      if (loadedConversationIdRef.current !== conversationId) {
        setMessages([]);
        updateMessageCursor(null);
        onErrorChange(null);
      }

      loadedConversationIdRef.current = conversationId;
      setMessageLoadState('idle');

      return true;
    },
    [onErrorChange, setMessageLoadState, updateMessageCursor],
  );
  const loadActiveMessages = useCallback(
    async (conversationId: string): Promise<void> => {
      const requestId = messageRequestRef.current + 1;

      messageAbortRef.current?.abort();
      messageAbortRef.current = null;
      messageRequestRef.current = requestId;

      if (openDirectTimeline(conversationId)) return;

      const controller = new AbortController();

      messageAbortRef.current = controller;
      loadedConversationIdRef.current = null;
      setMessages([]);
      updateMessageCursor(null);
      setMessageLoadState('loading');
      onErrorChange(null);
      try {
        const result = await applicationContainer.messages.load(
          sessionRef.current,
          conversationId,
          null,
          { signal: controller.signal },
        );

        if (messageRequestRef.current !== requestId) return;

        startTransition(() => {
          setMessages(MessageCollection.merge([], result.messages));
          updateMessageCursor(result.nextCursor ?? null);
          setMessageLoadState('idle');
          loadedConversationIdRef.current = conversationId;
        });
        markConversationReadUntil(conversationId, result.messages);
        scrollMessagesToBottom('auto', true);
      } catch (caught) {
        if (
          messageRequestRef.current !== requestId ||
          controller.signal.aborted
        ) {
          return;
        }

        loadedConversationIdRef.current = null;
        setMessages([]);
        setMessageLoadState('error');
        onErrorChange(
          toUserErrorMessage(caught, copy.workspace.loadMessagesError),
        );

        return;
      }

      if (
        messageRequestRef.current === requestId &&
        messageAbortRef.current === controller
      ) {
        messageAbortRef.current = null;
      }
    },
    [
      markConversationReadUntil,
      onErrorChange,
      openDirectTimeline,
      scrollMessagesToBottom,
      sessionRef,
      setMessageLoadState,
      updateMessageCursor,
    ],
  );
  const { handleScroll } = useWorkspaceMessageHistory({
    activeConversation,
    activeConversationKey,
    isScrolledNearBottom,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageCursorRef,
    messageRequestRef,
    messageScrollAnchorRef,
    messagesRef,
    messageStateRef,
    scrollerRef,
    sessionRef,
    setMessageLoadState,
    setMessages,
    setNewMessageCount,
    setSendError: onErrorChange,
    suppressMessageLoadsUntilRef,
    updateMessageCursor,
    workspaceMode,
  });
  const clearTimeline = useCallback((): void => {
    messageAbortRef.current?.abort();
    messageAbortRef.current = null;
    loadedConversationIdRef.current = null;
    setMessages([]);
    updateMessageCursor(null);
    setMessageLoadState('idle');
  }, [setMessageLoadState, updateMessageCursor]);
  const preserveTimeline = useCallback((): void => {
    setMessageLoadState('idle');
    scrollMessagesToBottom('auto', true);
  }, [scrollMessagesToBottom, setMessageLoadState]);
  const requestTimeline = useCallback((): void => {
    if (!activeConversationId) return;

    void loadActiveMessages(activeConversationId);
  }, [activeConversationId, loadActiveMessages]);

  useEffect(() => {
    const action = ConversationTimelineLoadPlan.decide({
      activeConversationId,
      activeConversationKeyAvailable,
      loadedConversationId: loadedConversationIdRef.current,
      workspaceMode,
    });

    setNewMessageCount(0);
    lastScrollTopRef.current = 0;

    switch (action) {
      case 'clear':
        clearTimeline();
        break;
      case 'load':
        requestTimeline();
        break;
      case 'preserve':
        preserveTimeline();
        break;
    }
  }, [
    activeConversationId,
    activeConversationKeyAvailable,
    clearTimeline,
    preserveTimeline,
    requestTimeline,
    workspaceMode,
  ]);

  useWorkspaceResumeSync({
    activeConversationId,
    activeConversationKeyId: activeConversationKey?.conversationId ?? null,
    loadActiveMessages,
    loadedMessages: messagesRef,
    onCommunitiesReload,
    refreshConversations,
    workspaceMode,
  });

  return {
    bottomRef,
    handleScroll,
    isScrolledNearBottom,
    jumpToLatestMessages,
    markConversationReadUntil,
    messageCursor,
    messages,
    messagesRef,
    messageState,
    newMessageCount,
    scrollerRef,
    scrollMessagesToBottom,
    setMessageLoadState,
    setMessages,
    setNewMessageCount,
    updateMessageCursor,
  };
}
