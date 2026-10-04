import type { Dispatch, SetStateAction } from 'react';

import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';
import type {
  ChatMessage,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';
import type { useCommunityMessageComposer } from './useCommunityMessageComposer';
import type { useCommunityThreadActions } from './useCommunityThreadActions';

type CommunityMessageMenuActionsInput = {
  messageComposer: ReturnType<typeof useCommunityMessageComposer>;
  messageContextMenu: MessageContextMenuState | null;
  openMessageThread: (message: ChatMessage) => Promise<void>;
  pinMessage: (message: ChatMessage) => Promise<void>;
  setMessageContextMenu: Dispatch<
    SetStateAction<MessageContextMenuState | null>
  >;
  setRawMessage: Dispatch<SetStateAction<ChatMessage | null>>;
  threadActions: ReturnType<typeof useCommunityThreadActions>;
  unpinMessage: (message: ChatMessage) => Promise<void>;
};

export type CommunityMessageMenuActions = {
  onDeleteMessage: (message: ChatMessage) => void;
  onDownloadAttachment: (attachment: MessageAttachment) => void;
  onEditMessage: (message: ChatMessage) => void;
  onOpenMessageThread: (message: ChatMessage) => void;
  onPinMessage: (message: ChatMessage) => void;
  onReplyToMessage: (message: ChatMessage) => void;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onUnpinMessage: (message: ChatMessage) => void;
  onViewRawMessage: (message: ChatMessage) => void;
};

export function communityMessageMenuActions({
  messageComposer,
  messageContextMenu,
  openMessageThread,
  pinMessage,
  setMessageContextMenu,
  setRawMessage,
  threadActions,
  unpinMessage,
}: CommunityMessageMenuActionsInput): CommunityMessageMenuActions {
  const fromThread = messageContextMenu?.source === 'thread';

  return {
    onDeleteMessage: (message) =>
      void (fromThread
        ? threadActions.deleteMessage(message)
        : messageComposer.handleDeleteChannelMessage(message)),
    onDownloadAttachment: (attachment) =>
      void messageComposer.openAttachment(attachment),
    onEditMessage: (message) =>
      fromThread
        ? threadActions.startEditing(message)
        : messageComposer.startEditingChannelMessage(message),
    onOpenMessageThread: (message) => void openMessageThread(message),
    onPinMessage: (message) => void pinMessage(message),
    onReplyToMessage: (message) => {
      if (fromThread) {
        threadActions.startReplying(message);

        return;
      }

      setMessageContextMenu(null);
      messageComposer.startReplyToMessage(message);
    },
    onToggleReaction: (message, emoji, reacted) =>
      void messageComposer.handleToggleChannelMessageReaction(
        message,
        emoji,
        reacted,
      ),
    onUnpinMessage: (message) => void unpinMessage(message),
    onViewRawMessage: (message) => {
      setRawMessage(message);
      setMessageContextMenu(null);
    },
  };
}
