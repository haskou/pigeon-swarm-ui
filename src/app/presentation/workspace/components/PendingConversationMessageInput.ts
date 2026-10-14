import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';

export type PendingConversationMessageInput = {
  attachments: File[];
  authorIdentityId: string;
  content: string;
  id: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
  timestamp: number;
};
