import type { MessageAttachment } from '../../../../attachments/application/contracts/MessageAttachment';
import type { MessageReplyPreview } from '../../../../messages/infrastructure/crypto/resources/MessageReplyPreview';
import type { MessageLinkPreview } from '../../../../messages/infrastructure/http/resources/MessageLinkPreview';
import type { StickerMessageReference } from '../../../../stickers/infrastructure/http/resources/StickerMessageReference';
import type { CommunityMessageMentionResource as CommunityMessageMention } from '../../http/resources/CommunityMessageMentionResource';

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
