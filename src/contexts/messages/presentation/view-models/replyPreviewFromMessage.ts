import type { ChatMessage } from '../../domain/ChatMessage';
import type { MessageReplyPreview } from '../../infrastructure/crypto/resources/MessageReplyPreview';

import { isBrowserPreviewImage } from '../../../../shared/presentation/isBrowserPreviewImage';

export function replyPreviewFromMessage(
  message?: ChatMessage | null,
): MessageReplyPreview | undefined {
  if (!message) return undefined;

  const image = message.attachments.find((attachment) =>
    isBrowserPreviewImage(attachment.contentType),
  );

  return {
    authorIdentityId: message.authorIdentityId,
    ...(message.content ? { content: message.content.slice(0, 180) } : {}),
    ...(image ? { image } : {}),
    messageId: message.id,
    ...(message.sticker ? { sticker: message.sticker } : {}),
  };
}
