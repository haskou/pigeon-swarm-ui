import type {
  AttachmentUploadOptions,
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type ConversationMessageDelivery = {
  retryMessage: (message: ChatMessage) => void;
  sendMessage: (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => Promise<void>;
  sendSticker: (sticker: StickerMessageReference) => Promise<void>;
};
