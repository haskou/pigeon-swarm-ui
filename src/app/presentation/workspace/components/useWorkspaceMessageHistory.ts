import type { LoadedMessagesResult } from './LoadedMessagesResult';
import type { WorkspaceMessageHistory } from './WorkspaceMessageHistory';
import type { WorkspaceMessageHistoryInput } from './WorkspaceMessageHistoryInput';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import {
  MessageScrollAnchor,
  type MessageScrollAnchorSnapshot,
} from '../../../../contexts/messages/presentation/view-models/MessageScrollAnchor';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';

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

function captureOlderMessagesViewport(input: WorkspaceMessageHistoryInput): {
  anchor: MessageScrollAnchorSnapshot | null;
  restorePreviousViewport: () => void;
} {
  const scroller = input.scrollerRef.current;
  const anchor = scroller ? MessageScrollAnchor.capture(scroller) : null;
  const previousHeight = scroller?.scrollHeight ?? 0;
  const previousTop = scroller?.scrollTop ?? 0;

  return {
    anchor,
    restorePreviousViewport: (): void => {
      if (!scroller || input.scrollerRef.current !== scroller) return;

      const nextTop = MessageScrollAnchor.restoreOrPreserveOffset(
        scroller,
        anchor,
        previousHeight,
        previousTop,
      );

      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.lastScrollTopRef.current = nextTop;
    },
  };
}

export function useWorkspaceMessageHistory(
  input: WorkspaceMessageHistoryInput,
): WorkspaceMessageHistory {
  const handleLoadOlder = async (): Promise<void> => {
    // eslint-disable-next-line no-param-reassign -- shared React ref
    input.keepMessageBottomUntilRef.current = 0;

    if (!canLoadOlderMessages(input)) return;

    const conversationId = input.activeConversation?.id;
    const requestedCursor = input.messageCursorRef.current;

    if (!conversationId || !requestedCursor) return;
    const requestId = input.messageRequestRef.current + 1;

    // eslint-disable-next-line no-param-reassign -- shared React ref
    input.messageRequestRef.current = requestId;
    const { anchor, restorePreviousViewport } =
      captureOlderMessagesViewport(input);

    // eslint-disable-next-line no-param-reassign -- shared React ref
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
        // eslint-disable-next-line no-param-reassign -- shared React ref
        input.messageScrollAnchorRef.current = null;
      });
    } catch (caught) {
      // eslint-disable-next-line no-param-reassign -- shared React ref
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

    // eslint-disable-next-line no-param-reassign -- shared React ref
    input.lastScrollTopRef.current = scrollTop;

    if (Date.now() < input.suppressMessageLoadsUntilRef.current) return;

    if (input.isScrolledNearBottom()) {
      input.setNewMessageCount(0);
    } else {
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.keepMessageBottomUntilRef.current = 0;
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp) {
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.keepMessageBottomUntilRef.current = 0;
      // eslint-disable-next-line no-param-reassign -- shared React ref
      input.messageScrollAnchorRef.current = null;
    }

    if (isScrollingUp && scrollTop < 80) void handleLoadOlder();
  };

  return { handleLoadOlder, handleScroll };
}
