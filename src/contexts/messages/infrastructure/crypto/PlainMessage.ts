/* eslint-disable @typescript-eslint/no-use-before-define */

import type {
  MessageAttachment,
  MessageLinkPreview,
  MessageReplyPreview,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type PlainMessage = {
  attachments?: MessageAttachment[];
  authorIdentityId?: string;
  content?: string;
  linkPreview?: MessageLinkPreview;
  reply?: MessageReplyPreview;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp?: number;
  type?: string;
};
