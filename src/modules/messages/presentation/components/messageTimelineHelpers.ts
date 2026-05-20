import type {
  ChatMessage,
  MessageAttachment,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { isBrowserPreviewImage } from '../../../../shared/presentation/browserPreview';
import { isSameDay } from '../../../../shared/presentation/formatting';

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
