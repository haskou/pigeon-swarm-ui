import type {
  ChatMessage,
  MessageAttachment,
  StickerMessageReference,
} from '../../domain/types';

import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { isSameDay } from '../../utils/formatting';

export function startsMessageDay(
  previousMessage: ChatMessage | undefined,
  message: ChatMessage,
): boolean {
  return (
    !previousMessage || !isSameDay(previousMessage.timestamp, message.timestamp)
  );
}

export function startsAuthorRun(
  previousMessage: ChatMessage | undefined,
  message: ChatMessage,
): boolean {
  return (
    !previousMessage ||
    previousMessage.authorIdentityId !== message.authorIdentityId
  );
}

export function endsAuthorRun(
  nextMessage: ChatMessage | undefined,
  message: ChatMessage,
): boolean {
  return (
    !nextMessage || nextMessage.authorIdentityId !== message.authorIdentityId
  );
}

export function findReplyMessage(
  messages: ChatMessage[],
  message: ChatMessage,
): ChatMessage | undefined {
  if (!message.replyToMessageId) return undefined;

  return messages.find((item) => item.id === message.replyToMessageId);
}

export function messageReplyImage(
  message: ChatMessage,
  replyMessage?: ChatMessage,
): MessageAttachment | undefined {
  const previewImage = message.replyPreview?.image;

  return (
    replyMessage?.attachments.find((attachment) =>
      isBrowserPreviewImage(attachment.contentType),
    ) ?? (isReplyPreviewImageAttachment(previewImage) ? previewImage : undefined)
  );
}

function isReplyPreviewImageAttachment(
  value: MessageAttachment | unknown,
): value is MessageAttachment {
  if (!value || typeof value !== 'object') return false;

  return (
    'contentType' in value &&
    typeof value.contentType === 'string' &&
    isBrowserPreviewImage(value.contentType)
  );
}

export function messageReplySticker(
  message: ChatMessage,
  replyMessage?: ChatMessage,
): StickerMessageReference | undefined {
  return replyMessage?.sticker ?? message.replyPreview?.sticker;
}
