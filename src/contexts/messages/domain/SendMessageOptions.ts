import type {
  AttachmentProgress,
  AttachmentUploadOptions,
} from '../../../shared/domain/pigeonResources.types';
import type { CommunityMessageMention } from '../../communities/application/communityResources.types';
import type { StickerMessageReference } from '../../stickers/domain/stickerResources.types';
import type { MessageLinkPreview } from './MessageLinkPreview';
import type { MessageReplyPreview } from './MessageReplyPreview';

export type SendMessageOptions = {
  attachmentUpload?: AttachmentUploadOptions;
  attachments?: File[];
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  onAttachmentProgress?: (progress: AttachmentProgress) => void;
  previousMessageIds?: string[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
};
