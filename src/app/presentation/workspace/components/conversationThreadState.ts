import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { ConversationThread } from './ConversationThread';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';

export type MessageCollectionState = {
  error: null | string;
  messages: ChatMessage[];
  state: 'loading' | 'ready';
};

// Stays beside MessageCollectionState until #298 retires its importers.
// eslint-disable-next-line no-restricted-syntax -- pinned export, see above
export type EditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

export function mergeConversationMessageIfTargetExists(
  currentMessages: ChatMessage[],
  incomingMessage: ChatMessage,
): ChatMessage[] {
  const targetMessageId = incomingMessage.raw.targetMessageId;

  if (
    incomingMessage.raw.type === 'edited' &&
    targetMessageId &&
    !currentMessages.some((message) => message.id === targetMessageId)
  ) {
    return currentMessages;
  }

  return MessageCollection.merge(currentMessages, [incomingMessage]);
}

export function mergeConversationThreadMessage(
  currentThread: ConversationThread,
  incomingMessage: ChatMessage,
): ConversationThread {
  const rootMessages = mergeConversationMessageIfTargetExists(
    [currentThread.root],
    incomingMessage,
  );
  const threadMessages = ThreadMessageVisibility.belongsToRoot(
    currentThread.root.id,
    incomingMessage,
  )
    ? mergeConversationMessageIfTargetExists(
        currentThread.messages,
        incomingMessage,
      )
    : currentThread.messages;

  return {
    ...currentThread,
    messages: threadMessages,
    root:
      rootMessages.find((message) => message.id === currentThread.root.id) ??
      currentThread.root,
  };
}

export function removeConversationThreadMessage(
  currentThread: ConversationThread,
  messageId: string,
): ConversationThread | null {
  if (currentThread.root.id === messageId) return null;

  const deletingEditedMessage =
    currentThread.editingMessage?.message.id === messageId;
  const deletingReplyTarget = currentThread.replyTarget?.id === messageId;

  return {
    ...currentThread,
    draft: deletingEditedMessage
      ? (currentThread.editingMessage?.previousDraft ?? '')
      : currentThread.draft,
    editingMessage: deletingEditedMessage ? null : currentThread.editingMessage,
    messages: currentThread.messages.filter(
      (message) => message.id !== messageId,
    ),
    replyTarget: deletingReplyTarget ? null : currentThread.replyTarget,
  };
}
