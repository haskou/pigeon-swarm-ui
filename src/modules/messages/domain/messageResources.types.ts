import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  MessageAttachment,
} from '../../attachments/domain/attachmentResources.types';
import type { CommunityMessageMention } from '../../communities/domain/communityResources.types';
import type {
  PollOption,
  PollResource,
  PollScope,
  PollVote,
} from '../../polls/domain/pollResources.types';
import type { StickerMessageReference } from '../../stickers/domain/stickerResources.types';

export type MessageReplyPreview = {
  authorIdentityId: string;
  content?: string;
  image?: MessageAttachment;
  messageId: string;
  sticker?: StickerMessageReference;
};

export type MessageLinkPreview = {
  description?: string;
  finalUrl: string;
  image?: string | null;
  siteName?: string;
  title?: string;
  url: string;
};

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
};

export type EditMessageOptions = {
  linkPreview?: MessageLinkPreview;
};

export type MessageResource = {
  actorIdentityId?: string;
  allowsMultipleVotes?: boolean;
  attachmentExternalIdentifiers?: string[];
  authorId?: string;
  authorIdentityId?: string;
  callEventType?: 'declined' | 'ended' | 'missed';
  callId?: string;
  channelId?: string;
  communityId?: string;
  content?: string;
  conversationId?: string;
  createdAt?: number;
  creatorIdentityId?: string;
  durationMs?: number;
  encryptedPayload?: string;
  editedAt?: number;
  expiresAt?: number;
  id?: string;
  mentions?: CommunityMessageMention[];
  messageId?: string;
  options?: PollOption[];
  payload?: string;
  poll?: PollResource;
  pollId?: string;
  previousMessageIds?: string[];
  question?: string;
  reactions?: MessageReaction[];
  replyToMessageId?: string;
  scope?: PollScope;
  signature?: string;
  status?: 'closed' | 'open';
  targetMessageId?: string;
  timestamp?: number;
  type?: string;
  votes?: PollVote[];
};

export type MessageReaction = {
  authorIdentityId: string;
  createdAt: number;
  emoji: string;
};

export type MessageSignaturePayload = {
  attachmentExternalIdentifiers: string[];
  authorId: string;
  conversationId: string;
  createdAt: number;
  encryptedPayload?: string;
  id: string;
  previousMessageIds: string[];
  replyToMessageId?: string;
  targetMessageId?: string;
  type: 'deleted' | 'edited' | 'sent';
};

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
  poll?: PollResource;
  raw: MessageResource;
  reactions: MessageReaction[];
  replyPreview?: MessageReplyPreview;
  replyToMessageId?: string;
  sticker?: StickerMessageReference;
  timestamp: number;
};
