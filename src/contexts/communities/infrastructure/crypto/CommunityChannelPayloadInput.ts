import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { MessageReplyPreview } from '../../../messages/infrastructure/crypto/resources/MessageReplyPreview';
import type { MessageLinkPreview } from '../../../messages/infrastructure/http/resources/MessageLinkPreview';
import type { StickerMessageReference } from '../../../stickers/infrastructure/http/resources/StickerMessageReference';
import type { CommunityMessageMentionResource as CommunityMessageMention } from '../http/resources/CommunityMessageMentionResource';

export type CommunityChannelPayloadInput = {
  attachments: MessageAttachment[];
  authorIdentityId: string;
  channelId: string;
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
