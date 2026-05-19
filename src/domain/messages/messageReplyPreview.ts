import type { ChatMessage, MessageReplyPreview } from '../types';

import { isBrowserPreviewImage } from '../../utils/browserPreview';

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
