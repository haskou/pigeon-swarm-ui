import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
  MessageResource,
  StickerMessageReference,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MarkdownMessage } from './MarkdownMessage';
import {
  AttachmentCard,
  ImageAttachmentAlbum,
  isImageAttachment,
  type IndexedAttachment,
} from './MessageAttachments';
import {
  groupMessageReactions,
  MessageReactions,
} from './MessageReactions';
import { MessageReplyPreview } from './MessageReplyPreview';
import {
  stickerAssetUrl,
  useStickerPressPreview,
} from './StickerPressPreview';

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
  onReactionToggle?: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  reactionAuthorNames?: Record<string, string>;
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
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  reactionAuthorNames = {},
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
  const stickerPreview = useStickerPressPreview(sticker?.assetCid ?? '');
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
        className={cx('flex items-center gap-3', mine && 'justify-end')}
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
            'flex max-w-[96%] flex-col sm:max-w-[72%]',
            mine ? 'items-end' : 'items-start',
          )}
        >
          <div
            className={cx(
              'flex max-w-full items-end gap-2',
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
                        ? 'bg-fuchsia-500 text-left text-white shadow-xl shadow-fuchsia-950/20'
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
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (stickerPreview.consumePreviewClick()) return;

                    onStickerClick?.(sticker);
                  }}
                  className="block touch-none select-none rounded-2xl p-1 transition hover:bg-white/10"
                  title="View sticker pack"
                  {...stickerPreview.pressPreviewHandlers}
                >
                  <img
                    src={stickerAssetUrl(sticker.assetCid)}
                    alt="Sticker"
                    className="max-h-48 max-w-48 object-contain sm:max-h-56 sm:max-w-56"
                    draggable={false}
                  />
                </button>
                {stickerPreview.previewPortal}
              </>
            )}
            {message.attachmentProgress && (
              <div className="mt-3 rounded-2xl bg-black/20 p-3 text-left text-xs font-black text-white/75">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {message.attachmentProgress.phase === 'encrypt'
                      ? copy.composer.encryptingAttachment
                      : message.attachmentProgress.phase === 'upload'
                        ? copy.composer.uploadingAttachment
                        : message.attachmentProgress.phase === 'download'
                          ? copy.composer.downloadingAttachment
                          : copy.composer.decryptingAttachment}{' '}
                    {message.attachmentProgress.filename}
                  </span>
                  <span className="shrink-0">
                    {message.attachmentProgress.percent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-fuchsia-400"
                    style={{ width: `${message.attachmentProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
            {message.content && !sticker && (
              <div
                className={cx(
                  'whitespace-pre-wrap break-words',
                  (hasReply || message.attachments.length > 0) && 'mt-3',
                  message.encrypted && 'text-white/55',
                )}
              >
                <MarkdownMessage content={message.content} mine={mine} />
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
            {(message.deliveryStatus === 'pending' ||
              message.deliveryStatus === 'failed') && (
              <div className="mt-1 flex items-center justify-end gap-2 text-xs font-black opacity-65">
                {message.deliveryStatus === 'pending' && (
                  <span>{copy.messages.sending}</span>
                )}
                {message.deliveryStatus === 'failed' && (
                  <>
                    <span className="text-rose-100">
                      {copy.messages.sendFailed}
                    </span>
                    {onRetryMessage && (
                      <button
                        type="button"
                        onClick={() => onRetryMessage(message)}
                        className="rounded-full bg-white/15 px-2 py-0.5 text-white transition hover:bg-white/25"
                      >
                        {copy.messages.retrySend}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            </div>
            <span className="mb-1 shrink-0 px-0.5 text-[0.68rem] font-bold leading-none text-white/30">
              {formatTime(message.timestamp)}
            </span>
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

function CallEventMessage({
  currentIdentityId,
  message,
}: {
  currentIdentityId: string;
  message: ChatMessage;
}) {
  const direction = callEventDirection(message, currentIdentityId);
  const label = callEventLabel(message.raw.callEventType);
  const duration = formatDuration(message.raw.durationMs);

  return (
    <div data-message-id={message.id} className="flex justify-center py-2">
      <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-white/55">
        {direction && (
          <>
            <span>{direction}</span>
            <span className="text-white/30"> · </span>
          </>
        )}
        <span>{label}</span>
        {duration && <span className="text-white/35"> · {duration}</span>}
        <span className="text-white/30">
          {' '}
          · {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function callEventDirection(
  message: ChatMessage,
  currentIdentityId: string,
): string | null {
  const actorIdentityId =
    message.raw.actorIdentityId ??
    (message.authorIdentityId !== 'unknown' &&
    message.authorIdentityId !== 'system'
      ? message.authorIdentityId
      : undefined);

  if (!actorIdentityId) return null;

  return actorIdentityId === currentIdentityId
    ? copy.calls.incomingCallDirection
    : copy.calls.outgoingCallDirection;
}

function callEventLabel(eventType: MessageResource['callEventType']): string {
  if (eventType === 'missed') return copy.calls.missed;

  if (eventType === 'declined') return copy.calls.declined;

  return copy.calls.ended;
}

function formatDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) return null;

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
