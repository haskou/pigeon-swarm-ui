import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { ThreadMessageVisibility } from '../../../messages/presentation/view-models/ThreadMessageVisibility';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { mergeChatMessages } from './communityWorkspaceHelpers';

export type CommunityThreadEditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

export type CommunityThreadState = {
  channelId: string;
  draft: string;
  editingMessage: CommunityThreadEditingMessage | null;
  error: null | string;
  messages: ChatMessage[];
  replyTarget: ChatMessage | null;
  root: ChatMessage;
  state: 'loading' | 'ready';
};

export function placeholderThreadRootMessage({
  channelId,
  communityId,
  currentIdentityId,
  rootMessageId,
}: {
  channelId: string;
  communityId: string;
  currentIdentityId: string;
  rootMessageId: string;
}): ChatMessage {
  return {
    attachments: [],
    authorIdentityId: currentIdentityId,
    content: copy.messages.originalMessage,
    encrypted: false,
    id: rootMessageId,
    mine: false,
    raw: {
      channelId,
      communityId,
      id: rootMessageId,
      type: 'sent',
    },
    reactions: [],
    timestamp: Date.now(),
  };
}

export function mergeCommunityThreadMessage(
  currentThread: CommunityThreadState,
  incomingMessage: ChatMessage,
): CommunityThreadState {
  const rootMessages =
    currentThread.root.id === incomingMessage.id
      ? mergeChatMessages([currentThread.root], [incomingMessage])
      : [currentThread.root];
  const messageAlreadyInThread = currentThread.messages.some(
    (message) => message.id === incomingMessage.id,
  );
  const messageBelongsToThread = ThreadMessageVisibility.belongsToRoot(
    currentThread.root.id,
    incomingMessage,
  );
  const threadMessages =
    messageAlreadyInThread || messageBelongsToThread
      ? mergeChatMessages(currentThread.messages, [incomingMessage])
      : currentThread.messages;

  return {
    ...currentThread,
    messages: threadMessages,
    root:
      rootMessages.find((message) => message.id === currentThread.root.id) ??
      currentThread.root,
  };
}

export function removeCommunityThreadMessage(
  currentThread: CommunityThreadState,
  messageId: string,
): CommunityThreadState | null {
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
    replyTarget: deletingReplyTarget ? null : currentThread.replyTarget,
    messages: currentThread.messages.filter((message) => message.id !== messageId),
  };
}

export function threadTitleFromMessage(message: ChatMessage): string {
  if (message.content.trim()) return message.content.trim().slice(0, 64);

  if (message.sticker) return copy.stickers.stickerAlt;

  if (message.attachments.length > 0) {
    return message.attachments[0]?.filename ?? copy.messages.thread;
  }

  return copy.messages.thread;
}

export function isThreadRootMessage(message: ChatMessage): boolean {
  return !(message.replyToMessageId ?? message.raw.replyToMessageId);
}

export function threadRootLabelKey(
  channelId: string,
  rootMessageId: string,
): string {
  return `${channelId}:${rootMessageId}`;
}
