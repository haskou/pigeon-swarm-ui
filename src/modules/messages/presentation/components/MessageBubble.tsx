import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { formatTime } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { Avatar } from './Avatar';
import { CallEventMessage } from './CallEventMessage';
import { ImageLightbox, type LightboxImage } from './imageLightbox';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MarkdownMessage, type MarkdownMention } from './markdownMessage';
import {
  AttachmentCard,
  ImageAttachmentAlbum,
  isImageAttachment,
} from './messageAttachments';
import {
  MessageAttachmentProgress,
  MessageDeliveryStatus,
  MessageStickerContent,
} from './messageBubbleContent';
import { groupMessageReactions, MessageReactions } from './messageReactions';
import { MessageReplyPreview } from './MessageReplyPreview';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
  authorName: string;
  authorPicture?: string | null;
  onAttachmentPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  onAttachmentOpen: (attachmentIndex: number) => void;
  onAvatarClick: (event: MouseEvent<HTMLElement>) => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onMentionClick?: (identityId: string, target: HTMLElement) => void;
  onReactionToggle?: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  reactionAuthorNames?: Record<string, string>;
  mentionTokens?: MarkdownMention[];
  replyImage?: MessageAttachment;
  replyAuthorName?: string;
  replyPreview?: string;
  replySticker?: StickerMessageReference;
  reserveAvatarSpace?: boolean;
  showAvatar: boolean;
}

export function MessageBubble({
  authorName,
  authorPicture,
  currentIdentityId,
  message,
  onAttachmentOpen,
  onAttachmentPreview,
  onAvatarClick,
  onMessageMenuOpen,
  onMentionClick,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  reactionAuthorNames = {},
  mentionTokens = [],
  replyAuthorName,
  replyImage,
  replyPreview,
  replySticker,
  reserveAvatarSpace = true,
  showAvatar,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;
  const callEvent =
    message.raw.type === 'call_event' || message.kind === 'call-event';
  const replyMessageId =
    message.replyToMessageId ?? message.replyPreview?.messageId;
  const hasReply = Boolean(replyMessageId);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexedAttachments = useMemo(
    () =>
      message.attachments.map((attachment, index) => ({ attachment, index })),
    [message.attachments],
  );
  const imageAttachments = useMemo(
    () =>
      indexedAttachments.filter(({ attachment }) =>
        isImageAttachment(attachment),
      ),
    [indexedAttachments],
  );
  const otherAttachments = useMemo(
    () =>
      indexedAttachments.filter(
        ({ attachment }) => !isImageAttachment(attachment),
      ),
    [indexedAttachments],
  );
  const linkPreview = message.linkPreview;
  const sticker = message.sticker;
  const stickerWithReply = Boolean(sticker && hasReply);
  const reactionGroups = useMemo(
    () =>
      groupMessageReactions(
        message.reactions,
        currentIdentityId,
        reactionAuthorNames,
      ),
    [currentIdentityId, message.reactions, reactionAuthorNames],
  );

  useEffect(() => clearLongPressTimer, []);

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onMessageMenuOpen(message, event.clientX, event.clientY);
  };
  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      onMessageMenuOpen(message, event.clientX, event.clientY);
    }, 550);
  };

  if (callEvent) {
    return (
      <CallEventMessage
        currentIdentityId={currentIdentityId}
        message={message}
      />
    );
  }

  return (
    <>
      <div
        data-message-id={message.id}
        className={cx('flex min-w-0 items-center gap-3', mine && 'justify-end')}
      >
        {!mine && (
          <MessageAvatarColumn
            authorName={authorName}
            authorPicture={authorPicture}
            onAvatarClick={onAvatarClick}
            reserveAvatarSpace={reserveAvatarSpace}
            showAvatar={showAvatar}
          />
        )}
        <div
          className={cx(
            'flex min-w-0 max-w-[96%] flex-col sm:max-w-[72%]',
            mine ? 'items-end' : 'items-start',
          )}
        >
          <div
            className={cx(
              'flex min-w-0 max-w-full items-end gap-2',
              mine && 'flex-row-reverse',
            )}
          >
            <div
              onContextMenu={handleContextMenu}
              style={{
                WebkitTouchCallout: 'none',
              }}
              onPointerCancel={clearLongPressTimer}
              onPointerDown={handlePointerDown}
              onPointerLeave={clearLongPressTimer}
              onPointerMove={clearLongPressTimer}
              onPointerUp={clearLongPressTimer}
              className={cx(
                'min-w-0 max-w-full select-text text-sm leading-6 [@media(pointer:coarse)]:select-none',
                sticker
                  ? 'rounded-2xl bg-transparent p-0'
                  : cx(
                      'rounded-2xl px-3 py-1.5',
                      mine
                        ? 'bg-[#274279] text-left text-white shadow-xl shadow-[#102938]/25'
                        : 'border border-white/10 bg-black/25 text-white',
                    ),
              )}
            >
              {hasReply && replyMessageId && (
                <MessageReplyPreview
                  mine={mine}
                  onAttachmentPreview={onAttachmentPreview}
                  onReplyReferenceClick={onReplyReferenceClick}
                  replyAuthorName={replyAuthorName}
                  replyImage={replyImage}
                  replyMessageId={replyMessageId}
                  replyPreview={replyPreview}
                  replySticker={replySticker}
                />
              )}
              {message.attachments.length > 0 && (
                <div className="grid gap-2">
                  {imageAttachments.length > 0 && (
                    <ImageAttachmentAlbum
                      items={imageAttachments}
                      mine={mine}
                      onOpen={(images, index) => setLightbox({ images, index })}
                      onPreview={onAttachmentPreview}
                    />
                  )}
                  {otherAttachments.map(({ attachment, index }) => (
                    <AttachmentCard
                      attachment={attachment}
                      key={`${message.id}-${attachment.cid}`}
                      mine={mine}
                      onPreview={onAttachmentPreview}
                      pending={message.deliveryStatus === 'pending'}
                      onClick={() => onAttachmentOpen(index)}
                    />
                  ))}
                </div>
              )}
              {sticker && (
                <div
                  className={cx(
                    stickerWithReply && 'flex items-end gap-2',
                    stickerWithReply && mine && 'flex-row-reverse',
                  )}
                >
                  <MessageStickerContent
                    mine={mine}
                    onStickerClick={onStickerClick}
                    sticker={sticker}
                  />
                  {stickerWithReply && (
                    <MessageTimestamp timestamp={message.timestamp} />
                  )}
                </div>
              )}
              {message.attachmentProgress && (
                <MessageAttachmentProgress
                  progress={message.attachmentProgress}
                />
              )}
              {message.content && !sticker && (
                <div
                  className={cx(
                    'whitespace-pre-wrap break-words',
                    (hasReply || message.attachments.length > 0) && 'mt-3',
                    message.encrypted && 'text-white/55',
                  )}
                >
                  <MarkdownMessage
                    content={message.content}
                    mentions={mentionTokens}
                    mine={mine}
                    onMentionClick={onMentionClick}
                  />
                </div>
              )}
              {message.edited && !sticker && (
                <div className="mt-1 text-[0.65rem] font-black uppercase text-white/45">
                  {copy.messages.edited}
                </div>
              )}
              {linkPreview && (
                <LinkPreviewCard
                  description={linkPreview.description}
                  finalUrl={linkPreview.finalUrl}
                  image={linkPreview.image}
                  mine={mine}
                  siteName={linkPreview.siteName}
                  title={linkPreview.title}
                  url={linkPreview.url}
                />
              )}
              <MessageDeliveryStatus
                message={message}
                onRetryMessage={onRetryMessage}
              />
            </div>
            {!stickerWithReply && (
              <MessageTimestamp timestamp={message.timestamp} />
            )}
          </div>
          {reactionGroups.length > 0 && (
            <MessageReactions
              groups={reactionGroups}
              mine={mine}
              onToggle={(emoji, reacted) => {
                onReactionToggle?.(message, emoji, reacted);
              }}
            />
          )}
        </div>
      </div>
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function MessageTimestamp({ timestamp }: { timestamp: number }) {
  return (
    <span className="mb-1 shrink-0 px-0.5 text-[0.68rem] font-bold leading-none text-white/30">
      {formatTime(timestamp)}
    </span>
  );
}

function MessageAvatarColumn({
  authorName,
  authorPicture,
  mine,
  onAvatarClick,
  reserveAvatarSpace,
  showAvatar,
}: {
  authorName: string;
  authorPicture?: string | null;
  mine?: boolean;
  onAvatarClick: (event: MouseEvent<HTMLElement>) => void;
  reserveAvatarSpace: boolean;
  showAvatar: boolean;
}) {
  if (!showAvatar && !reserveAvatarSpace) return null;

  return (
    <div
      className={cx(
        'relative flex h-11 w-11 shrink-0 items-center',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {showAvatar ? (
        <Avatar
          label={authorName}
          mine={mine}
          onClick={onAvatarClick}
          picture={authorPicture}
        />
      ) : (
        <div className="w-11 shrink-0" />
      )}
    </div>
  );
}
