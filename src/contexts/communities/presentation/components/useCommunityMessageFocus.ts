import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { CommunityChannelMessageLoadState } from './useCommunityChannelMessages';
import type { CommunityMessageSearchResultItem } from './CommunityMessageSearchPanel';

import { mergeChatMessages } from './communityWorkspaceHelpers';

type UseCommunityMessageFocusInput = {
  handleChannelSelected: (channelId: string) => void;
  messageState: CommunityChannelMessageLoadState;
  scrollerRef: RefObject<HTMLDivElement | null>;
  selectedChannelId: null | string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

type UseCommunityMessageFocusResult = {
  handleSearchResultClick: (result: CommunityMessageSearchResultItem) => void;
  queueFocusedMessage: (channelId: string, message: ChatMessage) => void;
  scrollToChannelMessage: (messageId: string) => void;
};

export function useCommunityMessageFocus({
  handleChannelSelected,
  messageState,
  scrollerRef,
  selectedChannelId,
  setMessages,
}: UseCommunityMessageFocusInput): UseCommunityMessageFocusResult {
  const pendingSearchResultRef =
    useRef<CommunityMessageSearchResultItem | null>(null);
  const pendingFocusedMessageRef = useRef<{
    channelId: string;
    message: ChatMessage;
  } | null>(null);
  const scrollToChannelMessage = useCallback(
    (messageId: string) => {
      const scroll = (attempt = 0) => {
        const element = scrollerRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(messageId)}"]`,
        );

        if (!element) {
          if (attempt < 8) {
            window.setTimeout(() => scroll(attempt + 1), 60);
          }

          return;
        }

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusTarget =
          element.querySelector<HTMLElement>('[data-message-bubble]') ??
          element;

        focusTarget.classList.add('message-focus-ring');
        window.setTimeout(
          () => focusTarget.classList.remove('message-focus-ring'),
          1600,
        );
      };

      requestAnimationFrame(() => scroll());
    },
    [scrollerRef],
  );
  const handleSearchResultClick = useCallback(
    (result: CommunityMessageSearchResultItem) => {
      pendingSearchResultRef.current = result;

      if (result.channelId !== selectedChannelId) {
        handleChannelSelected(result.channelId);

        return;
      }

      setMessages((current) => mergeChatMessages(current, [result.message]));
      scrollToChannelMessage(result.message.id);
      pendingSearchResultRef.current = null;
    },
    [
      handleChannelSelected,
      scrollToChannelMessage,
      selectedChannelId,
      setMessages,
    ],
  );
  const queueFocusedMessage = useCallback(
    (channelId: string, message: ChatMessage) => {
      pendingFocusedMessageRef.current = { channelId, message };
    },
    [],
  );

  useEffect(() => {
    const pending = pendingSearchResultRef.current;

    if (pending) {
      if (
        selectedChannelId !== pending.channelId ||
        messageState === 'loading'
      ) {
        return;
      }

      setMessages((current) => mergeChatMessages(current, [pending.message]));
      scrollToChannelMessage(pending.message.id);
      pendingSearchResultRef.current = null;
    }

    const pendingFocusedMessage = pendingFocusedMessageRef.current;

    if (!pendingFocusedMessage) return;

    if (
      selectedChannelId !== pendingFocusedMessage.channelId ||
      messageState === 'loading'
    ) {
      return;
    }

    setMessages((current) =>
      mergeChatMessages(current, [pendingFocusedMessage.message]),
    );
    scrollToChannelMessage(pendingFocusedMessage.message.id);
    pendingFocusedMessageRef.current = null;
  }, [messageState, scrollToChannelMessage, selectedChannelId, setMessages]);

  return {
    handleSearchResultClick,
    queueFocusedMessage,
    scrollToChannelMessage,
  };
}
