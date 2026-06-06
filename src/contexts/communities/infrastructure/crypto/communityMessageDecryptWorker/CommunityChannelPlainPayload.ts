import type {
  CommunityMessageMention,
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  StickerMessageReference,
} from '../../../../../shared/domain/pigeonResources.types';

export type CommunityChannelPlainPayload = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  content?: string;
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  reply?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp?: number;
  type?: string;
};
