import type {
  AttachmentUploadOptions,
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type ConversationMessageActions = {
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
