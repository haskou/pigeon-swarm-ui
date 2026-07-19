import type {
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { PendingMessageAttachments } from '../../../../contexts/attachments/presentation/view-models/PendingMessageAttachments';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';

type PendingConversationMessageInput = {
  attachments: File[];
  authorIdentityId: string;
  content: string;
  id: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
  timestamp: number;
};

export class PendingConversationMessage {
  public static create({
    attachments,
    authorIdentityId,
    content,
    id,
    replyTarget,
    sticker,
    timestamp,
  }: PendingConversationMessageInput): ChatMessage {
    return {
      attachments: PendingMessageAttachments.fromFiles(attachments, id),
      authorIdentityId,
      content: sticker
        ? ''
        : content ||
          attachments.map((attachment) => attachment.name).join(', '),
      deliveryStatus: 'pending',
      encrypted: false,
      id,
      mine: true,
      raw: { id, type: 'sent' },
      reactions: [],
      replyPreview: replyPreviewFromMessage(replyTarget),
      replyToMessageId: replyTarget?.id,
      sticker,
      timestamp,
    };
  }
}
