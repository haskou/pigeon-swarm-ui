import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { PreloadedConversationMessages } from '../PreloadedConversationMessages';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { ConversationTimelineLoadPlan } from './ConversationTimelineLoadPlan';
import { useMessageViewport } from './useMessageViewport';
import { useWorkspaceMessageHistory } from './useWorkspaceMessageHistory';
import { useWorkspaceResumeSync } from './useWorkspaceResumeSync';

export type ConversationMessageLoadState = 'error' | 'idle' | 'loading';

type UseConversationTimelineInput = {
  activeConversation?: ConversationResource;
  activeConversationKey?: ConversationKeyEntry;
  clearUnreadMessages: (conversationId: string) => void;
  onCommunitiesReload: () => Promise<void>;
  onConversationsChange: Dispatch<SetStateAction<ConversationResource[]>>;
  onErrorChange: (error: null | string) => void;
  preloadedConversationMessages: null | PreloadedConversationMessages;
  refreshConversations: () => Promise<ConversationResource[]>;
  sessionRef: MutableRefObject<Session>;
  suppressMessageLoadsUntilRef: MutableRefObject<number>;
  workspaceMode: 'community' | 'messages';
};

export type ConversationTimelineController = {
  bottomRef: ReturnType<typeof useMessageViewport>['bottomRef'];
  handleScroll: () => void;
  isScrolledNearBottom: () => boolean;
  jumpToLatestMessages: () => void;
  markConversationReadUntil: (
    conversationId: string,
    loadedMessages: ChatMessage[],
  ) => void;
  messageCursor: null | string;
  messageState: ConversationMessageLoadState;
  messages: ChatMessage[];
  messagesRef: MutableRefObject<ChatMessage[]>;
  newMessageCount: number;
  scrollerRef: ReturnType<typeof useMessageViewport>['scrollerRef'];
  scrollMessagesToBottom: ReturnType<
    typeof useMessageViewport
  >['scrollMessagesToBottom'];
  setMessageLoadState: (state: ConversationMessageLoadState) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  updateMessageCursor: (cursor: null | string) => void;
};

function initialMessages(
  preloaded: null | PreloadedConversationMessages,
): ChatMessage[] {
  if (!preloaded) return [];

  return MessageCollection.merge([], preloaded.messages);
}

function initialMessageCursor(
  preloaded: null | PreloadedConversationMessages,
): null | string {
  return preloaded?.nextCursor ?? null;
}

function initialMessageState(
  preloaded: null | PreloadedConversationMessages,
): ConversationMessageLoadState {
  return preloaded ? 'idle' : 'loading';
}

export function useConversationTimeline({
  activeConversation,
  activeConversationKey,
  clearUnreadMessages,
  onCommunitiesReload,
  onConversationsChange,
  onErrorChange,
  preloadedConversationMessages,
  refreshConversations,
  sessionRef,
  suppressMessageLoadsUntilRef,
  workspaceMode,
}: UseConversationTimelineInput): ConversationTimelineController {
  const preloadedConversationMessagesRef = useRef(
    preloadedConversationMessages,
  );
  const initiallyLoadedMessages = initialMessages(
    preloadedConversationMessages,
  );
  const loadedConversationIdRef = useRef<null | string>(
    preloadedConversationMessages?.conversationId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initiallyLoadedMessages,
  );
  const [messageCursor, setMessageCursor] = useState<null | string>(
    initialMessageCursor(preloadedConversationMessages),
  );
  const [messageState, setMessageState] =
    useState<ConversationMessageLoadState>(
      initialMessageState(preloadedConversationMessages),
    );
  const [newMessageCount, setNewMessageCount] = useState(0);
  const messageCursorRef = useRef<null | string>(
    initialMessageCursor(preloadedConversationMessages),
  );
  const messageAbortRef = useRef<AbortController | null>(null);
  const messageRequestRef = useRef(0);
  const messageStateRef = useRef<ConversationMessageLoadState>(
    initialMessageState(preloadedConversationMessages),
  );
  const messagesRef = useRef<ChatMessage[]>(initiallyLoadedMessages);
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
    layoutKey: activeConversation?.id ?? null,
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
      onConversationsChange((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation,
        ),
      );
      void applicationContainer.conversations
        .markReadUntil(sessionRef.current, conversationId, lastMessage.id)
        .catch(() => undefined);
    },
    [clearUnreadMessages, onConversationsChange, sessionRef],
  );
  const loadActiveMessages = useCallback(
    async (conversationId: string): Promise<void> => {
      const requestId = messageRequestRef.current + 1;
      const controller = new AbortController();

      messageAbortRef.current?.abort();
      messageAbortRef.current = controller;
      messageRequestRef.current = requestId;
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
  const usePreloadedTimeline = useCallback((): void => {
    const preloaded = preloadedConversationMessagesRef.current;

    if (!preloaded || !activeConversation) return;

    preloadedConversationMessagesRef.current = null;
    loadedConversationIdRef.current = activeConversation.id;
    setMessages(MessageCollection.merge([], preloaded.messages));
    updateMessageCursor(preloaded.nextCursor ?? null);
    setMessageLoadState('idle');
    markConversationReadUntil(activeConversation.id, preloaded.messages);
    scrollMessagesToBottom('auto', true);
  }, [
    activeConversation,
    markConversationReadUntil,
    scrollMessagesToBottom,
    setMessageLoadState,
    updateMessageCursor,
  ]);
  const preserveTimeline = useCallback((): void => {
    setMessageLoadState('idle');
    scrollMessagesToBottom('auto', true);
  }, [scrollMessagesToBottom, setMessageLoadState]);
  const requestTimeline = useCallback((): void => {
    if (!activeConversation) return;

    void loadActiveMessages(activeConversation.id);
  }, [activeConversation, loadActiveMessages]);

  useEffect(() => {
    const action = ConversationTimelineLoadPlan.decide({
      activeConversationId: activeConversation?.id,
      activeConversationKeyAvailable: Boolean(activeConversationKey),
      loadedConversationId: loadedConversationIdRef.current,
      preloadedConversationId:
        preloadedConversationMessagesRef.current?.conversationId ?? null,
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
      case 'use-preloaded':
        usePreloadedTimeline();
        break;
    }
  }, [
    activeConversation?.id,
    activeConversationKey,
    clearTimeline,
    preserveTimeline,
    requestTimeline,
    usePreloadedTimeline,
    workspaceMode,
  ]);

  useWorkspaceResumeSync({
    activeConversationId: activeConversation?.id,
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
