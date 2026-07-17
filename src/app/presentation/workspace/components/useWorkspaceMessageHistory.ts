import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';

import type {
  ChatMessage,
  ConversationKeyEntry,
  ConversationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import {
  MessageScrollAnchor,
  type MessageScrollAnchorSnapshot,
} from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

type LoadState = 'idle' | 'loading' | 'error';
type WorkspaceMode = 'community' | 'messages';

type WorkspaceMessageHistoryInput = {
  activeConversation?: ConversationResource;
  activeConversationKey?: ConversationKeyEntry;
  isScrolledNearBottom: () => boolean;
  keepMessageBottomUntilRef: MutableRefObject<number>;
  lastScrollTopRef: MutableRefObject<number>;
  messageCursorRef: MutableRefObject<string | null>;
  messageRequestRef: MutableRefObject<number>;
  messageScrollAnchorRef: MutableRefObject<MessageScrollAnchorSnapshot | null>;
  messageStateRef: MutableRefObject<LoadState>;
  messagesRef: MutableRefObject<ChatMessage[]>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<Session>;
  setMessageLoadState: (state: LoadState) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setNewMessageCount: Dispatch<SetStateAction<number>>;
  setSendError: (error: string | null) => void;
  suppressMessageLoadsUntilRef: MutableRefObject<number>;
  updateMessageCursor: (cursor: null | string) => void;
  workspaceMode: WorkspaceMode;
};

type WorkspaceMessageHistory = {
  handleLoadOlder: () => Promise<void>;
  handleScroll: () => void;
};

type LoadedMessagesResult = {
  messages: ChatMessage[];
  nextCursor?: null | string;
};

function canLoadOlderMessages(input: WorkspaceMessageHistoryInput): boolean {
  return !(
    input.workspaceMode !== 'messages' ||
    !input.activeConversation?.id ||
    !input.activeConversationKey ||
    !input.messageCursorRef.current ||
    input.messageStateRef.current === 'loading' ||
    Date.now() < input.suppressMessageLoadsUntilRef.current
  );
}

function isCurrentMessageRequest(
  input: WorkspaceMessageHistoryInput,
  requestId: number,
): boolean {
  return input.messageRequestRef.current === requestId;
}

function applyOlderMessages(
  input: WorkspaceMessageHistoryInput,
  result: LoadedMessagesResult,
  requestedCursor: string,
): void {
  const hasNewMessages = MessageCollection.hasUnknownMessages(
    input.messagesRef.current,
    result.messages,
  );
  const nextCursor = result.nextCursor ?? null;

  if (hasNewMessages) {
    input.setMessages((current) =>
      MessageCollection.merge(current, result.messages),
    );
  }

  input.updateMessageCursor(
    hasNewMessages && nextCursor !== requestedCursor ? nextCursor : null,
  );
}

export function useWorkspaceMessageHistory(
  input: WorkspaceMessageHistoryInput,
): WorkspaceMessageHistory {
  const handleLoadOlder = async (): Promise<void> => {
    input.keepMessageBottomUntilRef.current = 0;

    if (!canLoadOlderMessages(input)) return;

    const conversationId = input.activeConversation?.id;
    const requestedCursor = input.messageCursorRef.current;

    if (!conversationId || !requestedCursor) return;
    const requestId = input.messageRequestRef.current + 1;

    input.messageRequestRef.current = requestId;
    const scroller = input.scrollerRef.current;
    const anchor = scroller ? MessageScrollAnchor.capture(scroller) : null;
    const previousHeight = scroller?.scrollHeight ?? 0;
    const previousTop = scroller?.scrollTop ?? 0;
    const restorePreviousViewport = (): void => {
      if (!scroller || input.scrollerRef.current !== scroller) return;

      const nextTop = MessageScrollAnchor.restoreOrPreserveOffset(
        scroller,
        anchor,
        previousHeight,
        previousTop,
      );

      input.lastScrollTopRef.current = nextTop;
    };

    input.messageScrollAnchorRef.current = anchor;
    input.setMessageLoadState('loading');
    requestAnimationFrame(restorePreviousViewport);
    try {
      const result = await applicationContainer.messages.load(
        input.sessionRef.current,
        conversationId,
        requestedCursor,
      );

      if (!isCurrentMessageRequest(input, requestId)) return;

      applyOlderMessages(input, result, requestedCursor);
      requestAnimationFrame(() => {
        restorePreviousViewport();
        input.messageScrollAnchorRef.current = null;
      });
    } catch (caught) {
      input.messageScrollAnchorRef.current = null;
      input.setSendError(
        toUserErrorMessage(caught, copy.workspace.loadOlderError),
      );
    }

    if (!isCurrentMessageRequest(input, requestId)) return;

    input.setMessageLoadState('idle');
  };

  const handleScroll = (): void => {
    if (input.workspaceMode !== 'messages') return;

    const scrollTop = input.scrollerRef.current?.scrollTop ?? 0;
    const isScrollingUp = scrollTop < input.lastScrollTopRef.current;

    input.lastScrollTopRef.current = scrollTop;

    if (Date.now() < input.suppressMessageLoadsUntilRef.current) return;

    if (input.isScrolledNearBottom()) {
      input.setNewMessageCount(0);
    } else {
      input.keepMessageBottomUntilRef.current = 0;
      input.messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp) {
      input.keepMessageBottomUntilRef.current = 0;
      input.messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  return { handleLoadOlder, handleScroll };
}
