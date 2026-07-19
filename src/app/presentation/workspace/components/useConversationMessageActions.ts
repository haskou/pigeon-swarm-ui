import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  ConversationResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { EditingMessage } from './conversationThreadState';
import type { MessageContextMenuState } from './messageContextMenu';

import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { MessageReactionUpdater } from '../../../../contexts/messages/presentation/view-models/MessageReactionUpdater';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { useConversationMessageDelivery } from './useConversationMessageDelivery';

type ConversationMessageActionsInput = {
  activeConversation: ConversationResource | undefined;
  activeConversationDraft: string;
  activeConversationKeyAvailable: boolean;
  editingMessage: EditingMessage | null;
  messages: ChatMessage[];
  messagesRef: RefObject<ChatMessage[]>;
  onAttachmentProgressChange: (progress: AttachmentProgress | null) => void;
  onConversationsChange: Dispatch<SetStateAction<ConversationResource[]>>;
  onDraftsChange: Dispatch<SetStateAction<Record<string, string>>>;
  onErrorChange: (error: string | null) => void;
  onEditingMessageChange: (message: EditingMessage | null) => void;
  onMessageContextMenuChange: (menu: MessageContextMenuState | null) => void;
  onMessageLoadStateChange: (state: 'idle' | 'loading') => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  onReplyTargetChange: (message: ChatMessage | null) => void;
  onMessageCursorChange: (cursor: null | string) => void;
  replyTarget: ChatMessage | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  session: Session;
  updateActiveConversationDraft: (draft: string) => void;
};

type ConversationMessageActions = {
  cancelEdit: () => void;
  cancelReply: () => void;
  closeMessageMenu: () => void;
  copyMessageContent: (message: ChatMessage) => void;
  deleteMessage: (message: ChatMessage) => Promise<void>;
  editMessage: (content: string) => Promise<void>;
  openMessageMenu: (message: ChatMessage, x: number, y: number) => void;
  openReplyReference: (messageId: string) => Promise<void>;
  openThreadMessageMenu: (message: ChatMessage, x: number, y: number) => void;
  retryMessage: (message: ChatMessage) => void;
  scrollToMessage: (messageId: string) => void;
  sendMessage: (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => Promise<void>;
  sendSticker: (sticker: StickerMessageReference) => Promise<void>;
  startEditing: (message: ChatMessage) => void;
  startReplying: (message: ChatMessage) => void;
  toggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => Promise<void>;
};

export function useConversationMessageActions({
  activeConversation,
  activeConversationDraft,
  activeConversationKeyAvailable,
  editingMessage,
  messages,
  messagesRef,
  onAttachmentProgressChange,
  onConversationsChange,
  onDraftsChange,
  onEditingMessageChange,
  onErrorChange,
  onMessageContextMenuChange,
  onMessageCursorChange,
  onMessageLoadStateChange,
  onMessagesChange,
  onReplyTargetChange,
  replyTarget,
  scrollerRef,
  scrollToBottom,
  session,
  updateActiveConversationDraft,
}: ConversationMessageActionsInput): ConversationMessageActions {
  const { retryMessage, sendMessage, sendSticker } =
    useConversationMessageDelivery({
      activeConversation,
      messagesRef,
      onAttachmentProgressChange,
      onConversationsChange,
      onErrorChange,
      onMessagesChange,
      onReplyTargetChange,
      replyTarget,
      scrollToBottom,
      session,
    });

  const closeMessageMenu = useCallback(
    () => onMessageContextMenuChange(null),
    [],
  );
  const cancelReply = useCallback(() => onReplyTargetChange(null), []);
  const cancelEdit = useCallback(() => {
    if (!activeConversation?.id) {
      onEditingMessageChange(null);

      return;
    }

    const previousDraft = editingMessage?.previousDraft ?? '';

    onEditingMessageChange(null);
    onDraftsChange((current) => ({
      ...current,
      [activeConversation.id]: previousDraft,
    }));
  }, [activeConversation?.id, editingMessage?.previousDraft, onDraftsChange]);

  const openMessageMenu = useCallback(
    (message: ChatMessage, x: number, y: number) => {
      onMessageContextMenuChange({ message, x, y });
    },
    [],
  );
  const openThreadMessageMenu = useCallback(
    (message: ChatMessage, x: number, y: number) => {
      onMessageContextMenuChange({ message, source: 'thread', x, y });
    },
    [],
  );
  const copyMessageContent = useCallback(
    (message: ChatMessage) => {
      if (navigator.clipboard && message.content) {
        void navigator.clipboard.writeText(message.content);
      }

      closeMessageMenu();
    },
    [closeMessageMenu],
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      requestAnimationFrame(() => {
        const element = scrollerRef.current?.querySelector<HTMLElement>(
          `[data-message-id="${CSS.escape(messageId)}"]`,
        );

        if (!element) return;

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusTarget =
          element.querySelector<HTMLElement>('[data-message-bubble]') ??
          element;

        focusTarget.classList.add('message-focus-ring');
        window.setTimeout(
          () => focusTarget.classList.remove('message-focus-ring'),
          1600,
        );
      });
    },
    [scrollerRef],
  );

  const openReplyReference = useCallback(
    async (messageId: string) => {
      if (messages.some((message) => message.id === messageId)) {
        scrollToMessage(messageId);

        return;
      }

      if (!activeConversation?.id || !activeConversationKeyAvailable) return;

      onErrorChange(null);
      onMessageLoadStateChange('loading');
      try {
        const result = await applicationContainer.messages.loadAround(
          session,
          activeConversation.id,
          messageId,
        );

        onMessagesChange((current) =>
          MessageCollection.merge(current, result.messages),
        );
        onMessageCursorChange(result.previousCursor ?? null);

        if (result.messages.some((message) => message.id === messageId)) {
          scrollToMessage(messageId);

          return;
        }

        onErrorChange(copy.messages.replyTargetNotFound);
      } catch (caught) {
        onErrorChange(
          toUserErrorMessage(caught, copy.workspace.loadOlderError),
        );
      } finally {
        onMessageLoadStateChange('idle');
      }
    },
    [
      activeConversation?.id,
      activeConversationKeyAvailable,
      messages,
      onErrorChange,
      onMessageCursorChange,
      onMessageLoadStateChange,
      onMessagesChange,
      scrollToMessage,
      session,
    ],
  );

  const deleteMessage = useCallback(
    async (message: ChatMessage) => {
      if (!activeConversation?.id) return;

      closeMessageMenu();
      onErrorChange(null);
      try {
        await applicationContainer.messages.delete(
          session,
          activeConversation.id,
          message.id,
        );
        onMessagesChange((current) =>
          current.filter((item) => item.id !== message.id),
        );
      } catch (caught) {
        onErrorChange(toUserErrorMessage(caught, copy.messages.deleteError));
      }
    },
    [
      activeConversation?.id,
      closeMessageMenu,
      onErrorChange,
      onMessagesChange,
      session,
    ],
  );

  const startEditing = useCallback(
    (message: ChatMessage) => {
      if (!activeConversation?.id) return;

      closeMessageMenu();
      cancelReply();
      onEditingMessageChange({
        message,
        previousDraft: activeConversationDraft,
      });
      updateActiveConversationDraft(message.content);
    },
    [
      activeConversation?.id,
      activeConversationDraft,
      cancelReply,
      closeMessageMenu,
      updateActiveConversationDraft,
    ],
  );

  const editMessage = useCallback(
    async (content: string) => {
      if (!activeConversation?.id || !editingMessage) return;

      onErrorChange(null);
      try {
        const editEvent = await applicationContainer.messages.edit(
          session,
          activeConversation.id,
          editingMessage.message.id,
          content,
        );

        onMessagesChange((current) =>
          MessageCollection.merge(current, [editEvent]),
        );
        onEditingMessageChange(null);
        updateActiveConversationDraft('');
      } catch (caught) {
        onErrorChange(toUserErrorMessage(caught, copy.messages.editError));
      }
    },
    [
      activeConversation?.id,
      editingMessage,
      onErrorChange,
      onMessagesChange,
      session,
      updateActiveConversationDraft,
    ],
  );

  const toggleReaction = useCallback(
    async (message: ChatMessage, emoji: string, reacted: boolean) => {
      if (!activeConversation?.id) return;

      const action = reacted ? 'remove' : 'add';

      onErrorChange(null);
      onMessagesChange((current) =>
        current.map((item) =>
          item.id === message.id
            ? MessageReactionUpdater.update(
                item,
                session.identity.id,
                emoji,
                action,
              )
            : item,
        ),
      );

      try {
        if (reacted) {
          await applicationContainer.messages.removeReactionFrom(
            session,
            activeConversation.id,
            message.id,
            emoji,
          );
        } else {
          await applicationContainer.messages.addReactionTo(
            session,
            activeConversation.id,
            message.id,
            emoji,
          );
        }
      } catch (caught) {
        onErrorChange(toUserErrorMessage(caught, copy.messages.reactionError));
        onMessagesChange((current) =>
          current.map((item) =>
            item.id === message.id
              ? MessageReactionUpdater.update(
                  item,
                  session.identity.id,
                  emoji,
                  reacted ? 'add' : 'remove',
                )
              : item,
          ),
        );
      }
    },
    [activeConversation?.id, onErrorChange, onMessagesChange, session],
  );

  const startReplying = useCallback((message: ChatMessage) => {
    onMessageContextMenuChange(null);
    onEditingMessageChange(null);
    onReplyTargetChange(message);
  }, []);

  return {
    cancelEdit,
    cancelReply,
    closeMessageMenu,
    copyMessageContent,
    deleteMessage,
    editMessage,
    openMessageMenu,
    openReplyReference,
    openThreadMessageMenu,
    retryMessage,
    scrollToMessage,
    sendMessage,
    sendSticker,
    startEditing,
    startReplying,
    toggleReaction,
  };
}
