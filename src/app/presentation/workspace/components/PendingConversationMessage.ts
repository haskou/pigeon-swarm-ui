import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { PendingConversationMessageInput } from './PendingConversationMessageInput';

import { PendingMessageAttachments } from '../../../../contexts/attachments/presentation/view-models/PendingMessageAttachments';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';

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
