import type { MessageAttachment } from '../../attachments/domain/attachmentResources.types';
import type { StickerMessageReference } from '../../stickers/domain/stickerResources.types';

export type MessageReplyPreview = {
  authorIdentityId: string;
  content?: string;
  image?: MessageAttachment;
  messageId: string;
  sticker?: StickerMessageReference;
};
