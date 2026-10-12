import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { AttachmentProgress } from '../../../../contexts/attachments/application/contracts/AttachmentProgress';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { ConversationMessageActions } from './ConversationMessageActions';
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
      const focusMessage = () => {
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
      };

      requestAnimationFrame(focusMessage);
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

      if (activeConversation.type === 'one-to-one') {
        // One-to-one history lives in the mailbox; a reply target that is not
        // in the local timeline cannot be fetched from the legacy endpoint.
        onErrorChange(copy.messages.replyTargetNotFound);

        return;
      }

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
      activeConversation?.type,
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
      const removeMessage = (current: ChatMessage[]) => {
        const messageId = message.id;

        return current.filter((item) => item.id !== messageId);
      };

      try {
        if (activeConversation.type === 'one-to-one') {
          await applicationContainer.directMessages.delete(
            session,
            activeConversation,
            message.id,
          );
        } else {
          await applicationContainer.messages.delete(
            session,
            activeConversation.id,
            message.id,
          );
        }
        onMessagesChange(removeMessage);
      } catch (caught) {
        onErrorChange(toUserErrorMessage(caught, copy.messages.deleteError));
      }
    },
    [
      activeConversation,
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
        const editEvent =
          activeConversation.type === 'one-to-one'
            ? await applicationContainer.directMessages.edit(
                session,
                activeConversation,
                editingMessage.message.id,
                content,
                {},
              )
            : await applicationContainer.messages.edit(
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
      activeConversation,
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
      const reactionUpdate = (reactionAction: 'add' | 'remove') => {
        const messageId = message.id;

        return (current: ChatMessage[]) =>
          current.map((item) =>
            item.id === messageId
              ? MessageReactionUpdater.update(
                  item,
                  session.identity.id,
                  emoji,
                  reactionAction,
                )
              : item,
          );
      };

      onErrorChange(null);
      onMessagesChange(reactionUpdate(action));

      try {
        if (activeConversation.type === 'one-to-one') {
          await applicationContainer.directMessages.reaction(
            session,
            activeConversation,
            {
              action,
              createdAt: Date.now(),
              emoji,
              messageId: message.id,
            },
          );
        } else if (reacted) {
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
        onMessagesChange(reactionUpdate(reacted ? 'add' : 'remove'));
      }
    },
    [activeConversation, onErrorChange, onMessagesChange, session],
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
