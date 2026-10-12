import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
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
