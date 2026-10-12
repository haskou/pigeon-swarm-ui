import type {
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

export type PendingConversationMessageInput = {
  attachments: File[];
  authorIdentityId: string;
  content: string;
  id: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
  timestamp: number;
};
