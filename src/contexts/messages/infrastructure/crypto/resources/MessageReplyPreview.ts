import type { MessageAttachment } from '../../../../../shared/domain/pigeonResources.types';
import type { StickerMessageReference } from '../../../../stickers/infrastructure/http/resources/StickerMessageReference';

export type MessageReplyPreview = {
  authorIdentityId: string;
  content?: string;
  image?: MessageAttachment;
  messageId: string;
  sticker?: StickerMessageReference;
};
