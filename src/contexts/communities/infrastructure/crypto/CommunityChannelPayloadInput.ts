import type {
  ConversationKeyEntry,
  CommunityMessageMention,
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type CommunityChannelPayloadInput = {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
  communityKey?: ConversationKeyEntry;
  communityId: string;
  content: string;
  eventType?:
    | 'CommunityChannelMessageEdited'
    | 'CommunityChannelThreadMessageSent'
    | 'CommunityChannelThreadStickerMessageSent';
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp: number;
};
