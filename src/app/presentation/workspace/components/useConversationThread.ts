import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import type { AttachmentUploadOptions } from '../../../../contexts/attachments/application/contracts/AttachmentUploadOptions';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';
import type { ConversationThread } from './ConversationThread';
import type { UseConversationThreadResult } from './UseConversationThreadResult';

import { conversationSupportsThreads } from '../../../../contexts/conversations/presentation/view-models/conversationSupportsThreads';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  mergeConversationMessageIfTargetExists,
  mergeConversationThreadMessage,
  removeConversationThreadMessage,
} from './conversationThreadState';
import { runStickerUsageSideEffect } from './runStickerUsageSideEffect';
import { syncConversationThread } from './syncConversationThread';

type UseConversationThreadInput = {
  activeConversation?: ConversationResource;
  closeMessageContextMenu: () => void;
  messages: ChatMessage[];
  session: Session;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

function previousMessageIds(thread: ConversationThread): string[] {
  const lastMessage = thread.messages[thread.messages.length - 1];

  return [lastMessage?.id ?? thread.root.id];
}

export function useConversationThread(
  input: UseConversationThreadInput,
): UseConversationThreadResult {
  const {
    activeConversation,
    closeMessageContextMenu,
    messages,
    session,
    setMessages,
  } = input;
  const [thread, setThread] = useState<ConversationThread | null>(null);

  useEffect(() => {
    if (!conversationSupportsThreads(activeConversation)) {
      setThread(null);
    }
  }, [activeConversation?.id, activeConversation?.type]);

  // Group sync keeps thread replies in the conversation timeline, so the open
  // thread follows that timeline instead of a separate node listing.
  useEffect(() => {
    setThread((current) =>
      current ? syncConversationThread(current, messages) : current,
    );
  }, [messages]);

  const open = (message: ChatMessage) => {
    if (
      !activeConversation ||
      !conversationSupportsThreads(activeConversation)
    ) {
      return;
    }

    closeMessageContextMenu();
    setThread({
      draft: '',
      editingMessage: null,
      error: null,
      messages: ThreadMessageVisibility.forRoot(message.id, messages),
      replyTarget: null,
      root: message,
      state: 'ready',
    });
  };

  const updateDraft = (draft: string) => {
    setThread((current) => (current ? { ...current, draft } : current));
  };

  const startEditing = (message: ChatMessage) => {
    if (!activeConversation) return;

    closeMessageContextMenu();
    setThread((current) =>
      current
        ? {
            ...current,
            draft: message.content,
            editingMessage: { message, previousDraft: current.draft },
            replyTarget: null,
          }
        : current,
    );
  };

  const cancelEditing = () => {
    setThread((current) =>
      current
        ? {
            ...current,
            draft: current.editingMessage?.previousDraft ?? '',
            editingMessage: null,
          }
        : current,
    );
  };

  const startReplying = (message: ChatMessage) => {
    if (!conversationSupportsThreads(activeConversation)) return;

    closeMessageContextMenu();
    setThread((current) =>
      current
        ? { ...current, editingMessage: null, replyTarget: message }
        : current,
    );
  };

  const cancelReplying = () => {
    setThread((current) =>
      current ? { ...current, replyTarget: null } : current,
    );
  };

  const setThreadError = (caught: unknown, fallback: string) => {
    setThread((current) =>
      current
        ? { ...current, error: toUserErrorMessage(caught, fallback) }
        : current,
    );
  };

  const appendSentMessage = (message: ChatMessage) => {
    setMessages((current) => MessageCollection.merge(current, [message]));
    setThread((current) =>
      current
        ? {
            ...current,
            draft: '',
            messages: MessageCollection.merge(current.messages, [message]),
            replyTarget: null,
          }
        : current,
    );
  };

  const edit = async (content: string) => {
    if (!activeConversation || !thread?.editingMessage) return;

    const targetMessage = thread.editingMessage.message;

    setThread((current) => (current ? { ...current, error: null } : current));
    try {
      const edited = await applicationContainer.groupMessages.edit(
        session,
        activeConversation,
        targetMessage.id,
        content,
        {},
      );

      setMessages((current) =>
        mergeConversationMessageIfTargetExists(current, edited),
      );
      setThread((current) =>
        current
          ? {
              ...mergeConversationThreadMessage(current, edited),
              draft: '',
              editingMessage: null,
              error: null,
              replyTarget: null,
            }
          : current,
      );
    } catch (caught) {
      setThreadError(caught, copy.messages.editError);
    }
  };

  const remove = async (message: ChatMessage) => {
    if (!activeConversation) return;

    closeMessageContextMenu();
    setThread((current) => (current ? { ...current, error: null } : current));
    try {
      await applicationContainer.groupMessages.delete(
        session,
        activeConversation,
        message.id,
      );
      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
      setThread((current) =>
        current ? removeConversationThreadMessage(current, message.id) : null,
      );
    } catch (caught) {
      setThreadError(caught, copy.messages.deleteError);
    }
  };

  const send = async (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => {
    if (!activeConversation || !thread) return;

    const sent = await applicationContainer.groupMessages.send(
      session,
      activeConversation,
      content,
      {
        attachments,
        attachmentUpload: {
          ...attachmentUpload,
          networkId: activeConversation.networkId,
        },
        previousMessageIds: previousMessageIds(thread),
        replyPreview: replyPreviewFromMessage(thread.replyTarget),
        replyToMessageId: thread.root.id,
        threadRootMessageId: thread.root.id,
      },
    );

    appendSentMessage(sent);
  };

  const sendSticker = async (sticker: StickerMessageReference) => {
    if (!activeConversation || !thread) return;

    const sent = await applicationContainer.groupMessages.send(
      session,
      activeConversation,
      '',
      {
        previousMessageIds: previousMessageIds(thread),
        replyPreview: replyPreviewFromMessage(thread.replyTarget),
        replyToMessageId: thread.root.id,
        sticker,
        threadRootMessageId: thread.root.id,
      },
    );

    runStickerUsageSideEffect(() =>
      applicationContainer.stickers.markUsed(session, sticker),
    );
    appendSentMessage(sent);
  };

  return {
    cancelEditing,
    cancelReplying,
    close: () => setThread(null),
    edit,
    open,
    remove,
    send,
    sendSticker,
    setThread,
    startEditing,
    startReplying,
    thread,
    updateDraft,
  };
}
