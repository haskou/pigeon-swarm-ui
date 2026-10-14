import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { ConversationMessageLoadState } from './ConversationMessageLoadState';
import type { ConversationTimelineController } from './ConversationTimelineController';
import type { UseConversationTimelineInput } from './UseConversationTimelineInput';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationTimelineLoadPlan } from './ConversationTimelineLoadPlan';
import { useMessageViewport } from './useMessageViewport';
import { useWorkspaceMessageHistory } from './useWorkspaceMessageHistory';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';

export function useConversationTimeline({
  activeConversation,
  activeConversationReady,
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
  const loadedConversationIdRef = useRef<null | string>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageState, setMessageState] =
    useState<ConversationMessageLoadState>('loading');
  const [newMessageCount, setNewMessageCount] = useState(0);
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
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

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
      void applicationContainer.conversations
        .markReadUntil(
          sessionRef.current,
          conversationId,
          lastMessage.id,
          activeConversationRef.current,
        )
        .catch(() => undefined);
    },
    [clearUnreadMessages, onConversationsChange, sessionRef],
  );
  /**
   * A conversation timeline comes only from its mailboxes: the one-to-one or
   * group mailbox sync restores stored history and applies new records.
   * Opening clears it on a conversation switch and keeps it on a resume.
   */
  const openTimeline = useCallback(
    (conversationId: string): void => {
      if (loadedConversationIdRef.current !== conversationId) {
        setMessages([]);
        onErrorChange(null);
      }

      loadedConversationIdRef.current = conversationId;
      setMessageState('idle');
    },
    [onErrorChange],
  );
  const { handleScroll } = useWorkspaceMessageHistory({
    isScrolledNearBottom,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageScrollAnchorRef,
    scrollerRef,
    setNewMessageCount,
    suppressMessageLoadsUntilRef,
    workspaceMode,
  });
  const clearTimeline = useCallback((): void => {
    loadedConversationIdRef.current = null;
    setMessages([]);
    setMessageState('idle');
  }, []);
  const preserveTimeline = useCallback((): void => {
    setMessageState('idle');
    scrollMessagesToBottom('auto', true);
  }, [scrollMessagesToBottom]);
  const requestTimeline = useCallback((): void => {
    if (!activeConversationId) return;

    openTimeline(activeConversationId);
  }, [activeConversationId, openTimeline]);

  useEffect(() => {
    const action = ConversationTimelineLoadPlan.decide({
      activeConversationId,
      activeConversationReady,
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
    activeConversationReady,
    clearTimeline,
    preserveTimeline,
    requestTimeline,
    workspaceMode,
  ]);

  useWorkspaceResumeSync({
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
    messages,
    messagesRef,
    messageState,
    newMessageCount,
    scrollerRef,
    scrollMessagesToBottom,
    setMessages,
    setNewMessageCount,
  };
}
