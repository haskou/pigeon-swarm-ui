import type {
  ConversationKeyEntry,
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  Session,
  StickerMessageReference,
} from '../../../shared/domain/pigeonResources.types';

export type EncryptMessagePayloadInput = {
  content: string;
  conversationId: string;
  eventType?:
    | 'MessageEdited'
    | 'MessageSent'
    | 'StickerMessageSent'
    | 'ThreadMessageSent'
    | 'ThreadStickerMessageSent';
  key: ConversationKeyEntry;
  linkPreview?: MessageLinkPreview;
  messageAttachments: MessageAttachment[];
  replyPreview?: MessageReplyPreview;
  session: Session;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp: number;
};
