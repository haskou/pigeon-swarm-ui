import type { ChatMessage, MessageAttachment } from '../../domain/types';

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
  return (
    replyMessage?.attachments.find((attachment) =>
      isBrowserPreviewImage(attachment.contentType),
    ) ?? message.replyPreview?.image
  );
}
