import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';

import {
  MessageScrollAnchor,
  type MessageScrollAnchorSnapshot,
} from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';

type MessageViewportInput = {
  layoutKey: null | string;
  messageCount: number;
  messageState: 'error' | 'idle' | 'loading';
  onJumpToLatest: () => void;
};

type MessageViewport = {
  bottomRef: RefObject<HTMLDivElement | null>;
  isScrolledNearBottom: () => boolean;
  jumpToLatestMessages: () => void;
  keepMessageBottomUntilRef: RefObject<number>;
  lastScrollTopRef: RefObject<number>;
  messageScrollAnchorRef: RefObject<MessageScrollAnchorSnapshot | null>;
  scrollMessagesToBottom: (
    behavior?: ScrollBehavior,
    keepPinned?: boolean,
  ) => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
};

export function useMessageViewport({
  layoutKey,
  messageCount,
  messageState,
  onJumpToLatest,
}: MessageViewportInput): MessageViewport {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const keepMessageBottomUntilRef = useRef(0);
  const messageScrollAnchorRef = useRef<MessageScrollAnchorSnapshot | null>(
    null,
  );

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto', keepPinned = false) => {
      const pinUntil = keepPinned ? Date.now() + 5000 : 0;
      const scroll = () => {
        if (keepPinned && keepMessageBottomUntilRef.current !== pinUntil) {
          return;
        }

        const scroller = scrollerRef.current;

        if (!scroller) return;

        MessageScrollAnchor.scrollToBottom(scroller, behavior);
        lastScrollTopRef.current = scroller.scrollTop;
      };

      if (keepPinned) keepMessageBottomUntilRef.current = pinUntil;

      requestAnimationFrame(() => {
        scroll();
        requestAnimationFrame(scroll);
        window.setTimeout(scroll, 120);
        window.setTimeout(scroll, 450);
      });
    },
    [],
  );

  const isScrolledNearBottom = useCallback((): boolean => {
    const scroller = scrollerRef.current;

    if (!scroller) return true;

    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96
    );
  }, []);

  const jumpToLatestMessages = useCallback(() => {
    onJumpToLatest();
    scrollMessagesToBottom('smooth');
  }, [onJumpToLatest, scrollMessagesToBottom]);

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const handleMediaLayoutChange = () => {
      const restoredTop = MessageScrollAnchor.restore(
        scroller,
        messageScrollAnchorRef.current,
      );

      if (restoredTop !== null) {
        lastScrollTopRef.current = restoredTop;

        return;
      }

      messageScrollAnchorRef.current = null;

      if (Date.now() > keepMessageBottomUntilRef.current) return;

      requestAnimationFrame(() => {
        lastScrollTopRef.current = MessageScrollAnchor.scrollToBottom(scroller);
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

  useLayoutEffect(() => {
    if (Date.now() > keepMessageBottomUntilRef.current) return undefined;

    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const scroll = () => {
      if (
        scrollerRef.current !== scroller ||
        Date.now() > keepMessageBottomUntilRef.current
      ) {
        return;
      }

      lastScrollTopRef.current = MessageScrollAnchor.scrollToBottom(scroller);
    };
    const frame = requestAnimationFrame(scroll);

    scroll();

    return () => cancelAnimationFrame(frame);
  }, [layoutKey, messageCount, messageState]);

  return {
    bottomRef,
    isScrolledNearBottom,
    jumpToLatestMessages,
    keepMessageBottomUntilRef,
    lastScrollTopRef,
    messageScrollAnchorRef,
    scrollMessagesToBottom,
    scrollerRef,
  };
}
