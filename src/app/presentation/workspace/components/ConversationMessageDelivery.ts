import type { AttachmentUploadOptions } from '../../../../contexts/attachments/application/contracts/AttachmentUploadOptions';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';

export type ConversationMessageDelivery = {
  retryMessage: (message: ChatMessage) => void;
  sendMessage: (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => Promise<void>;
  sendSticker: (sticker: StickerMessageReference) => Promise<void>;
};
