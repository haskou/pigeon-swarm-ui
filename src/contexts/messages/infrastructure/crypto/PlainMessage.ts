/* eslint-disable @typescript-eslint/no-use-before-define */

import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { CommunityMessageMentionResource as CommunityMessageMention } from '../../../communities/infrastructure/http/resources/CommunityMessageMentionResource';
import type { StickerMessageReference } from '../../../stickers/infrastructure/http/resources/StickerMessageReference';
import type { MessageLinkPreview } from '../http/resources/MessageLinkPreview';
import type { MessageReplyPreview } from './resources/MessageReplyPreview';

export type PlainMessage = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  content?: string;
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  reply?: MessageReplyPreview;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp?: number;
  type?: string;
};
