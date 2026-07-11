import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type {
  AttachmentUploadOptions,
  ChatMessage,
  CommunityChannelThreadSummary,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { MessageContextMenuState } from '../../../../app/presentation/workspace/components/messageContextMenu';
import type { useCommunityMessageComposer } from './useCommunityMessageComposer';
import type { CommunityThreadState } from './communityThreadState';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { ThreadMessageVisibility } from '../../../messages/presentation/view-models/ThreadMessageVisibility';
import { mergeChatMessages } from './communityWorkspaceHelpers';
import {
  mergeCommunityThreadMessage,
  removeCommunityThreadMessage,
} from './communityThreadState';

type CommunityMessageComposer = ReturnType<typeof useCommunityMessageComposer>;

type CommunityThreadActionsInput = {
  channelThreadsByChannelId: Record<
    string,
    CommunityChannelThreadSummary[]
  >;
  messageComposer: CommunityMessageComposer;
  selectedChannelId: null | string;
  setMessageContextMenu: Dispatch<
    SetStateAction<MessageContextMenuState | null>
  >;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setThreadPanel: Dispatch<SetStateAction<CommunityThreadState | null>>;
  threadPanel: CommunityThreadState | null;
  upsertChannelThreadSummary: (
    channelId: string,
    summary: CommunityChannelThreadSummary,
  ) => void;
};

export function useCommunityThreadActions({
  channelThreadsByChannelId,
  messageComposer,
  selectedChannelId,
  setMessageContextMenu,
  setMessages,
  setThreadPanel,
  threadPanel,
  upsertChannelThreadSummary,
}: CommunityThreadActionsInput) {
  const updateDraft = useCallback(
    (value: string) => {
      setThreadPanel((current) =>
        current ? { ...current, draft: value } : current,
      );
    },
    [setThreadPanel],
  );

  const startEditing = useCallback(
    (message: ChatMessage) => {
      setMessageContextMenu(null);
      setThreadPanel((current) =>
        current
          ? {
              ...current,
              draft: message.content,
              editingMessage: {
                message,
                previousDraft: current.draft,
              },
              replyTarget: null,
            }
          : current,
      );
    },
    [setMessageContextMenu, setThreadPanel],
  );

  const cancelEditing = useCallback(() => {
    setThreadPanel((current) =>
      current
        ? {
            ...current,
            draft: current.editingMessage?.previousDraft ?? '',
            editingMessage: null,
          }
        : current,
    );
  }, [setThreadPanel]);

  const startReplying = useCallback(
    (message: ChatMessage) => {
      setMessageContextMenu(null);
      setThreadPanel((current) =>
        current
          ? {
              ...current,
              editingMessage: null,
              replyTarget: message,
            }
          : current,
      );
    },
    [setMessageContextMenu, setThreadPanel],
  );

  const cancelReplying = useCallback(() => {
    setThreadPanel((current) =>
      current ? { ...current, replyTarget: null } : current,
    );
  }, [setThreadPanel]);

  const editMessage = useCallback(
    async (content: string) => {
      if (!threadPanel?.editingMessage) return;

      const targetMessage = threadPanel.editingMessage.message;

      setThreadPanel((current) =>
        current ? { ...current, error: null } : current,
      );
      try {
        const projected = await messageComposer.editChannelMessage(
          targetMessage,
          content,
        );

        setMessages((current) =>
          current.some((message) => message.id === projected.id)
            ? mergeChatMessages(current, [projected])
            : current,
        );
        setThreadPanel((current) =>
          current
            ? {
                ...mergeCommunityThreadMessage(current, projected),
                draft: '',
                editingMessage: null,
                error: null,
                replyTarget: null,
              }
            : current,
        );
      } catch (caught) {
        setThreadPanel((current) =>
          current
            ? {
                ...current,
                error: toUserErrorMessage(caught, copy.messages.editError),
              }
            : current,
        );
      }
    },
    [messageComposer, setMessages, setThreadPanel, threadPanel],
  );

  const deleteMessage = useCallback(
    async (message: ChatMessage) => {
      if (!window.confirm(copy.messages.deleteConfirm)) return;

      setMessageContextMenu(null);
      setThreadPanel((current) =>
        current ? { ...current, error: null } : current,
      );
      try {
        const deleted = await messageComposer.deleteChannelMessage(message);

        if (!deleted) return;

        setMessages((current) =>
          current.filter((item) => item.id !== message.id),
        );
        setThreadPanel((current) =>
          current
            ? removeCommunityThreadMessage(current, message.id)
            : current,
        );
      } catch (caught) {
        setThreadPanel((current) =>
          current
            ? {
                ...current,
                error: toUserErrorMessage(caught, copy.messages.deleteError),
              }
            : current,
        );
      }
    },
    [messageComposer, setMessageContextMenu, setMessages, setThreadPanel],
  );

  const recordSentMessage = useCallback(
    (sent: ChatMessage) => {
      if (!threadPanel) return;

      setThreadPanel((current) =>
        current
          ? {
              ...current,
              draft: '',
              messages: mergeChatMessages(current.messages, [sent]),
              replyTarget: null,
            }
          : current,
      );
      upsertChannelThreadSummary(threadPanel.channelId, {
        lastReplyAt: sent.timestamp,
        lastReplyMessageId: sent.id,
        replyCount: threadPanel.messages.some(
          (message) => message.id === sent.id,
        )
          ? threadPanel.messages.length
          : threadPanel.messages.length + 1,
        rootMessageId: threadPanel.root.id,
      });
    },
    [setThreadPanel, threadPanel, upsertChannelThreadSummary],
  );

  const sendMessage = useCallback(
    async (
      content: string,
      attachments: File[],
      attachmentUpload: AttachmentUploadOptions,
    ) => {
      if (!threadPanel) return;

      const sent = await messageComposer.sendReplyToMessage(
        threadPanel.root,
        content,
        attachments,
        attachmentUpload,
        {
          renderInChannel: false,
          replyPreviewTarget: threadPanel.replyTarget,
          threadRootMessageId: threadPanel.root.id,
        },
      );

      if (sent) recordSentMessage(sent);
    },
    [messageComposer, recordSentMessage, threadPanel],
  );

  const sendSticker = useCallback(
    async (sticker: StickerMessageReference) => {
      if (!threadPanel) return;

      const sent = await messageComposer.sendStickerReplyToMessage(
        threadPanel.root,
        sticker,
        {
          renderInChannel: false,
          replyPreviewTarget: threadPanel.replyTarget,
          threadRootMessageId: threadPanel.root.id,
        },
      );

      if (sent) recordSentMessage(sent);
    },
    [messageComposer, recordSentMessage, threadPanel],
  );

  const receiveRealtimeMessage = useCallback(
    (message: ChatMessage) => {
      const channelId = message.raw.channelId ?? selectedChannelId;
      const rootMessageId = ThreadMessageVisibility.rootMessageId(message);

      if (!channelId || !rootMessageId) return;

      const currentSummary = channelThreadsByChannelId[channelId]?.find(
        (thread) => thread.rootMessageId === rootMessageId,
      );

      setThreadPanel((current) =>
        current?.channelId === channelId && current.root.id === rootMessageId
          ? {
              ...current,
              messages: mergeChatMessages(current.messages, [message]),
            }
          : current,
      );
      upsertChannelThreadSummary(channelId, {
        lastReplyAt: message.timestamp,
        lastReplyMessageId: message.id,
        replyCount: currentSummary
          ? currentSummary.replyCount +
            (currentSummary.lastReplyMessageId === message.id ? 0 : 1)
          : 1,
        rootMessageId,
      });
    },
    [
      channelThreadsByChannelId,
      selectedChannelId,
      setThreadPanel,
      upsertChannelThreadSummary,
    ],
  );

  const applyRealtimeEdit = useCallback(
    (message: ChatMessage) => {
      setThreadPanel((current) =>
        current ? mergeCommunityThreadMessage(current, message) : current,
      );
    },
    [setThreadPanel],
  );

  const applyRealtimeDeletion = useCallback(
    (messageId: string) => {
      setThreadPanel((current) =>
        current ? removeCommunityThreadMessage(current, messageId) : current,
      );
    },
    [setThreadPanel],
  );

  return {
    applyRealtimeDeletion,
    applyRealtimeEdit,
    cancelEditing,
    cancelReplying,
    deleteMessage,
    editMessage,
    receiveRealtimeMessage,
    sendMessage,
    sendSticker,
    startEditing,
    startReplying,
    updateDraft,
  };
}
