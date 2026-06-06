import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { MessageCollection } from '../../../../contexts/messages/domain/MessageCollection';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';

export type MessageCollectionState = {
  error: null | string;
  messages: ChatMessage[];
  state: 'loading' | 'ready';
};

export type ConversationThreadState = MessageCollectionState & {
  draft: string;
  editingMessage: EditingMessage | null;
  replyTarget: ChatMessage | null;
  root: ChatMessage;
};

export type EditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

export function mergeConversationThreadMessage(
  currentThread: ConversationThreadState,
  incomingMessage: ChatMessage,
): ConversationThreadState {
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
  currentThread: ConversationThreadState,
  messageId: string,
): ConversationThreadState | null {
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
