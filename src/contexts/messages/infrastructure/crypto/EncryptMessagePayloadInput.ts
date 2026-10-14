import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { StickerMessageReference } from '../../../stickers/infrastructure/http/resources/StickerMessageReference';
import type { MessageLinkPreview } from '../http/resources/MessageLinkPreview';
import type { MessagePayloadSeal } from './MessagePayloadSeal';
import type { MessageReplyPreview } from './resources/MessageReplyPreview';

export type EncryptMessagePayloadInput = {
  content: string;
  conversationId: string;
  eventType?:
    | 'MessageEdited'
    | 'MessageSent'
    | 'StickerMessageSent'
    | 'ThreadMessageSent'
    | 'ThreadStickerMessageSent';
  linkPreview?: MessageLinkPreview;
  messageAttachments: MessageAttachment[];
  replyPreview?: MessageReplyPreview;
  seal: MessagePayloadSeal;
  session: Session;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp: number;
};
