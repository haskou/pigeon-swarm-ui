import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../attachments/infrastructure/attachmentResources.types';
import type { CommunityMessageMentionResource as CommunityMessageMention } from '../../../communities/infrastructure/http/resources/CommunityMessageMentionResource';
import type { PollResource } from '../../../polls/infrastructure/http/resources/PollResource';
import type { StickerMessageReference } from '../../../stickers/domain/stickerResources.types';
import type { MessageLinkPreview } from '../../infrastructure/http/resources/MessageLinkPreview';
import type { MessageReplyPreview } from '../../infrastructure/crypto/resources/MessageReplyPreview';
import type { MessageReaction } from '../../infrastructure/http/MessageReaction';
import type { MessageResource } from '../../infrastructure/http/MessageResource';

export type ChatMessage = {
  attachmentProgress?: AttachmentProgress;
  attachments: MessageAttachment[];
  authorIdentityId: string;
  content: string;
  deliveryStatus?: 'failed' | 'pending';
  edited?: boolean;
  editedAt?: number;
  editMessageId?: string;
  encrypted: boolean;
  id: string;
  kind?: 'call-event' | 'message' | 'poll';
  linkPreview?: MessageLinkPreview;
  mentions?: CommunityMessageMention[];
  mine: boolean;
  originalContent?: string;
  poll?: PollResource;
  raw: MessageResource;
  reactions: MessageReaction[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  threadRootMessageId?: string;
  timestamp: number;
};
