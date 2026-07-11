import { type Dispatch, type SetStateAction, useState } from 'react';

import type {
  AttachmentUploadOptions,
  ChatMessage,
  ConversationResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { MessageCollection } from '../../../../contexts/messages/domain/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { ThreadMessageVisibility } from '../../../../contexts/messages/presentation/view-models/ThreadMessageVisibility';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import {
  type ConversationThreadState,
  mergeConversationMessageIfTargetExists,
  mergeConversationThreadMessage,
  removeConversationThreadMessage,
} from './conversationThreadState';

type UseConversationThreadInput = {
  activeConversation: ConversationResource | null;
  closeMessageContextMenu: () => void;
  session: Session;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useConversationThread(input: UseConversationThreadInput) {
  const { activeConversation, closeMessageContextMenu, session, setMessages } =
    input;
  const [thread, setThread] = useState<ConversationThreadState | null>(null);

  const open = async (message: ChatMessage) => {
    if (!activeConversation) return;

    closeMessageContextMenu();
    setThread({
      draft: '',
      editingMessage: null,
      error: null,
      messages: [],
      replyTarget: null,
      root: message,
      state: 'loading',
    });
    try {
      const result = await applicationContainer.messages.loadThread(
        session,
        activeConversation.id,
        message.id,
      );

      setThread({
        draft: '',
        editingMessage: null,
        error: null,
        messages: ThreadMessageVisibility.forRoot(
          message.id,
          ThreadMessageVisibility.markAsThreadMessages(
            message.id,
            result.messages,
          ),
        ),
        replyTarget: null,
        root: message,
        state: 'ready',
      });
    } catch (caught) {
      setThread({
        draft: '',
        editingMessage: null,
        error: toUserErrorMessage(caught, copy.messages.threadError),
        messages: [],
        replyTarget: null,
        root: message,
        state: 'ready',
      });
    }
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

  const edit = async (content: string) => {
    if (!activeConversation || !thread?.editingMessage) return;

    const targetMessage = thread.editingMessage.message;

    setThread((current) => (current ? { ...current, error: null } : current));
    try {
      const editEvent = await applicationContainer.messages.edit(
        session,
        activeConversation.id,
        targetMessage.id,
        content,
      );

      setMessages((current) =>
        mergeConversationMessageIfTargetExists(current, editEvent),
      );
      setThread((current) =>
        current
          ? {
              ...mergeConversationThreadMessage(current, editEvent),
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
      await applicationContainer.messages.delete(
        session,
        activeConversation.id,
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

    const sent = await applicationContainer.messages.send(
      session,
      activeConversation.id,
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

    const sent = await applicationContainer.messages.send(
      session,
      activeConversation.id,
      '',
      {
        previousMessageIds: previousMessageIds(thread),
        replyPreview: replyPreviewFromMessage(thread.replyTarget),
        replyToMessageId: thread.root.id,
        sticker,
        threadRootMessageId: thread.root.id,
      },
    );

    void applicationContainer.stickers.markUsed(session, sticker);
    appendSentMessage(sent);
  };

  const appendSentMessage = (message: ChatMessage) => {
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

  const setThreadError = (caught: unknown, fallback: string) => {
    setThread((current) =>
      current
        ? { ...current, error: toUserErrorMessage(caught, fallback) }
        : current,
    );
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

function previousMessageIds(thread: ConversationThreadState): string[] {
  const lastMessage = thread.messages[thread.messages.length - 1];

  return [lastMessage?.id ?? thread.root.id];
}
