import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { mergeChatMessages } from './communityWorkspaceHelpers';

export type CommunityChannelMessageLoadState = 'error' | 'idle' | 'loading';

export type LoadedCommunityChannelMessages = {
  cursor: null | string;
  loadedMessages: ChatMessage[];
};

export type LoadCommunityChannelMessages = (
  channelId: string,
  beforeMessageId?: string,
  options?: { limit?: number },
) => Promise<LoadedCommunityChannelMessages>;

type UseCommunityChannelMessagesInput = {
  loadChannelMessages: LoadCommunityChannelMessages;
  onChannelSelected: (channelId: string) => void;
  onChannelViewed?: (channelId: string) => void;
  onMobileSidebarClose: () => void;
  resolvedChannelId: null | string;
};

type UseCommunityChannelMessagesResult = {
  bottomRef: RefObject<HTMLDivElement | null>;
  handleChannelSelected: (channelId: string) => void;
  handleMessagesScroll: () => void;
  incrementNewChannelMessageCount: () => void;
  isAwayFromBottom: boolean;
  isScrolledNearBottom: () => boolean;
  jumpToLatest: () => void;
  messageCursor: null | string;
  messages: ChatMessage[];
  messageState: CommunityChannelMessageLoadState;
  newChannelMessageCount: number;
  resetNewChannelMessageCount: () => void;
  scrollChannelToBottom: (
    behavior?: ScrollBehavior,
    keepPinned?: boolean,
  ) => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
  selectedChannelId: null | string;
  setSelectedChannelId: Dispatch<SetStateAction<null | string>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  visibleMessages: ChatMessage[];
};

function isBrowserPageVisible(): boolean {
  return (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
}

export function useCommunityChannelMessages({
  loadChannelMessages,
  onChannelSelected,
  onChannelViewed,
  onMobileSidebarClose,
  resolvedChannelId,
}: UseCommunityChannelMessagesInput): UseCommunityChannelMessagesResult {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    resolvedChannelId,
  );
  const [newChannelMessageCount, setNewChannelMessageCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<null | string>(null);
  const [messageState, setMessageState] =
    useState<CommunityChannelMessageLoadState>('idle');
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const keepChannelBottomUntilRef = useRef(0);
  const messageStateRef = useRef<CommunityChannelMessageLoadState>('idle');
  const loadChannelMessagesRef = useRef(loadChannelMessages);
  const onChannelSelectedRef = useRef(onChannelSelected);
  const onChannelViewedRef = useRef(onChannelViewed);
  const selectedChannelIdRef = useRef(selectedChannelId);
  const channelWasHiddenRef = useRef(!isBrowserPageVisible());
  const channelResumeSyncAtRef = useRef(0);

  useEffect(() => {
    loadChannelMessagesRef.current = loadChannelMessages;
    onChannelSelectedRef.current = onChannelSelected;
    onChannelViewedRef.current = onChannelViewed;
  }, [loadChannelMessages, onChannelSelected, onChannelViewed]);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);

  const setMessageLoadState = useCallback(
    (state: CommunityChannelMessageLoadState) => {
      messageStateRef.current = state;
      setMessageState(state);
    },
    [],
  );

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) => message.deliveryStatus || message.raw.type !== 'deleted',
      ),
    [messages],
  );

  const isScrolledNearBottom = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return true;

    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140
    );
  }, []);

  const scrollChannelToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto', keepPinned = false) => {
      const scroll = () => bottomRef.current?.scrollIntoView({ behavior });

      if (keepPinned) {
        keepChannelBottomUntilRef.current = Date.now() + 5000;
      }

      requestAnimationFrame(() => {
        scroll();
        requestAnimationFrame(scroll);
        window.setTimeout(scroll, 120);
        window.setTimeout(scroll, 450);
      });
    },
    [],
  );

  const resetNewChannelMessageCount = useCallback(() => {
    setNewChannelMessageCount(0);
  }, []);

  const incrementNewChannelMessageCount = useCallback(() => {
    setNewChannelMessageCount((current) => current + 1);
  }, []);

  const jumpToLatest = useCallback(() => {
    setNewChannelMessageCount(0);
    setIsAwayFromBottom(false);

    if (selectedChannelId) onChannelViewedRef.current?.(selectedChannelId);

    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [selectedChannelId]);

  const handleChannelSelected = useCallback(
    (channelId: string) => {
      setSelectedChannelId(channelId);
      setNewChannelMessageCount(0);
      onChannelViewedRef.current?.(channelId);
      onChannelSelectedRef.current(channelId);
      onMobileSidebarClose();
    },
    [onMobileSidebarClose],
  );

  const handleMessagesScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    const nearBottom = isScrolledNearBottom();

    setIsAwayFromBottom(!nearBottom);

    if (nearBottom) {
      setNewChannelMessageCount(0);

      if (selectedChannelId) onChannelViewedRef.current?.(selectedChannelId);
    }

    if (!scroller || scroller.scrollTop > 80 || !messageCursor) return;

    if (messageStateRef.current === 'loading' || !selectedChannelId) return;

    const previousHeight = scroller.scrollHeight;

    setMessageLoadState('loading');
    void loadChannelMessagesRef
      .current(selectedChannelId, messageCursor)
      .then(({ cursor, loadedMessages }) => {
        setMessages((current) => [...loadedMessages, ...current]);
        setMessageCursor(cursor);
        requestAnimationFrame(() => {
          if (!scrollerRef.current) return;

          scrollerRef.current.scrollTop =
            scrollerRef.current.scrollHeight - previousHeight;
        });
      })
      .catch(() => setMessageLoadState('error'))
      .finally(() => setMessageLoadState('idle'));
  }, [
    isScrolledNearBottom,
    messageCursor,
    selectedChannelId,
    setMessageLoadState,
  ]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const handleMediaLayoutChange = () => {
      if (Date.now() > keepChannelBottomUntilRef.current) return;

      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
      });
    };

    scroller.addEventListener('load', handleMediaLayoutChange, true);
    scroller.addEventListener('loadedmetadata', handleMediaLayoutChange, true);
    scroller.addEventListener('canplay', handleMediaLayoutChange, true);

    return () => {
      scroller.removeEventListener('load', handleMediaLayoutChange, true);
      scroller.removeEventListener(
        'loadedmetadata',
        handleMediaLayoutChange,
        true,
      );
      scroller.removeEventListener('canplay', handleMediaLayoutChange, true);
    };
  }, []);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      setMessageCursor(null);
      setMessageLoadState('idle');

      return undefined;
    }

    let cancelled = false;

    setMessages([]);
    setMessageCursor(null);
    setNewChannelMessageCount(0);
    setMessageLoadState('loading');
    void loadChannelMessagesRef
      .current(selectedChannelId)
      .then(({ cursor, loadedMessages }) => {
        if (cancelled) return;

        setMessages(loadedMessages);
        setMessageCursor(cursor);
        setNewChannelMessageCount(0);
        onChannelViewedRef.current?.(selectedChannelId);
        scrollChannelToBottom('auto', true);
      })
      .catch(() => {
        if (!cancelled) setMessageLoadState('error');
      })
      .finally(() => {
        if (!cancelled) setMessageLoadState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [scrollChannelToBottom, selectedChannelId, setMessageLoadState]);

  const syncVisibleChannel = useCallback(() => {
    if (!isBrowserPageVisible()) {
      channelWasHiddenRef.current = true;

      return;
    }

    const channelId = selectedChannelId;

    if (!channelWasHiddenRef.current || !channelId) return;

    const now = Date.now();

    if (now - channelResumeSyncAtRef.current < 1500) return;

    const shouldStickToBottom = isScrolledNearBottom();

    channelWasHiddenRef.current = false;
    channelResumeSyncAtRef.current = now;
    void loadChannelMessagesRef
      .current(channelId)
      .then(({ cursor, loadedMessages }) => {
        if (selectedChannelIdRef.current !== channelId) return;

        setMessages((current) => mergeChatMessages(current, loadedMessages));
        setMessageCursor(cursor);

        if (shouldStickToBottom) {
          setNewChannelMessageCount(0);
          onChannelViewedRef.current?.(channelId);
          scrollChannelToBottom('auto', true);
        }
      })
      .catch(() => undefined);
  }, [isScrolledNearBottom, scrollChannelToBottom, selectedChannelId]);
  const markChannelHidden = useCallback(() => {
    channelWasHiddenRef.current = true;
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', syncVisibleChannel);
    window.addEventListener('pagehide', markChannelHidden);
    window.addEventListener('focus', syncVisibleChannel);
    window.addEventListener('pageshow', syncVisibleChannel);

    return () => {
      document.removeEventListener('visibilitychange', syncVisibleChannel);
      window.removeEventListener('pagehide', markChannelHidden);
      window.removeEventListener('focus', syncVisibleChannel);
      window.removeEventListener('pageshow', syncVisibleChannel);
    };
  }, [markChannelHidden, syncVisibleChannel]);

  return {
    bottomRef,
    handleChannelSelected,
    handleMessagesScroll,
    incrementNewChannelMessageCount,
    isAwayFromBottom,
    isScrolledNearBottom,
    jumpToLatest,
    messageCursor,
    messages,
    messageState,
    newChannelMessageCount,
    resetNewChannelMessageCount,
    scrollChannelToBottom,
    scrollerRef,
    selectedChannelId,
    setSelectedChannelId,
    setMessages,
    visibleMessages,
  };
}
