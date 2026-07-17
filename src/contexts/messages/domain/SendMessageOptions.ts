import type {
  AttachmentProgress,
  AttachmentUploadOptions,
} from '../../../shared/domain/pigeonResources.types';
import type { CommunityMessageMentionResource as CommunityMessageMention } from '../../communities/infrastructure/http/resources/CommunityMessageMentionResource';
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
