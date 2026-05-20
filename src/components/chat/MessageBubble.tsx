import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
  MessageLinkPreview,
  MessageResource,
  StickerMessageReference,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { MarkdownMessage } from './MarkdownMessage';
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

type IndexedAttachment = {
  attachment: MessageAttachment;
  index: number;
};

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
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
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

  useEffect(() => {
    if (!replyImage) {
      setReplyImageUrl(null);

      return;
    }

    let cancelled = false;
    let loadedUrl: string | null = null;

    setReplyImageUrl(null);
    void onAttachmentPreview(replyImage)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        loadedUrl = url;
        setReplyImageUrl(url);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;

      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    };
  }, [onAttachmentPreview, replyImage]);

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
                'min-w-0 max-w-[calc(100%-3.25rem)] select-text text-sm leading-6 [@media(pointer:coarse)]:select-none',
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
                <button
                  type="button"
                  onClick={() => onReplyReferenceClick(replyMessageId)}
                  className={cx(
                    'mb-2 block w-full min-w-0 max-w-full rounded-2xl border px-3 py-2 text-left text-xs transition',
                    mine
                      ? 'border-white/20 bg-white/10 hover:bg-white/15'
                      : 'border-fuchsia-300/20 bg-fuchsia-400/10 hover:bg-fuchsia-400/15',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {replyImageUrl && (
                      <img
                        src={replyImageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                    )}
                    {replySticker && (
                      <img
                        src={stickerAssetUrl(replySticker.assetCid)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-xl object-contain"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-white/75">
                        {copy.messages.replyTo}{' '}
                        {replyAuthorName ?? copy.messages.originalMessage}
                      </span>
                      {replyPreview ? (
                        <span className="block truncate text-white/55">
                          {replyPreview}
                        </span>
                      ) : replySticker ? (
                        <span className="block truncate text-white/55">Sticker</span>
                      ) : null}
                    </span>
                  </span>
                </button>
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

type ReactionGroup = {
  authors: string[];
  count: number;
  emoji: string;
  lastCreatedAt: number;
  reacted: boolean;
};

function MessageReactions({
  groups,
  mine,
  onToggle,
}: {
  groups: ReactionGroup[];
  mine?: boolean;
  onToggle: (emoji: string, reacted: boolean) => void;
}) {
  return (
    <div
      className={cx(
        'mt-1 flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {groups.map((group) => (
        <button
          type="button"
          key={group.emoji}
          onClick={() => onToggle(group.emoji, group.reacted)}
          className={cx(
            'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-black leading-none shadow-sm backdrop-blur transition hover:brightness-110',
            group.reacted
              ? 'border-sky-200/45 bg-sky-400/35 text-sky-50 shadow-sky-950/20'
              : 'border-white/12 bg-black/25 text-white/78 shadow-black/15 hover:bg-white/10',
          )}
          aria-label={`${group.emoji} ${group.count}`}
          title={group.authors.join(', ')}
        >
          <span className="text-[0.82rem] leading-none">{group.emoji}</span>
          <span className="tabular-nums leading-none">{group.count}</span>
        </button>
      ))}
    </div>
  );
}

function groupMessageReactions(
  reactions: ChatMessage['reactions'],
  currentIdentityId: string,
  authorNames: Record<string, string>,
): ReactionGroup[] {
  const byEmoji = new Map<string, ReactionGroup>();

  for (const reaction of reactions ?? []) {
    const current = byEmoji.get(reaction.emoji) ?? {
      authors: [],
      count: 0,
      emoji: reaction.emoji,
      lastCreatedAt: reaction.createdAt,
      reacted: false,
    };

    current.authors.push(
      authorNames[reaction.authorIdentityId] ?? reaction.authorIdentityId,
    );
    current.count += 1;
    current.lastCreatedAt = Math.max(current.lastCreatedAt, reaction.createdAt);
    current.reacted =
      current.reacted || reaction.authorIdentityId === currentIdentityId;
    byEmoji.set(reaction.emoji, current);
  }

  return [...byEmoji.values()].sort((left, right) => {
    const createdAtDiff = left.lastCreatedAt - right.lastCreatedAt;

    return createdAtDiff === 0
      ? left.emoji.localeCompare(right.emoji)
      : createdAtDiff;
  });
}

function LinkPreviewCard({
  description,
  finalUrl,
  image,
  mine,
  siteName,
  title,
  url,
}: MessageLinkPreview & { mine: boolean }) {
  const safePreviewUrl =
    safeLinkPreviewUrl(finalUrl) ?? safeLinkPreviewUrl(url);
  const safeImageUrl = safeLinkPreviewUrl(image)?.toString() ?? null;
  const [imageVisible, setImageVisible] = useState(Boolean(safeImageUrl));
  const displayUrl = safePreviewUrl
    ? displayLinkPreviewUrl(safePreviewUrl)
    : '';
  const hostname = safePreviewUrl ? linkPreviewHostname(safePreviewUrl) : '';
  const faviconUrl = safePreviewUrl ? linkPreviewFaviconUrl(safePreviewUrl) : '';
  const label = siteName?.trim() || hostname;

  useEffect(() => {
    setImageVisible(Boolean(safeImageUrl));
  }, [safeImageUrl]);

  if (!safePreviewUrl) return null;

  return (
    <a
      href={safePreviewUrl.toString()}
      target="_blank"
      rel="noreferrer"
      className={cx(
        'mt-3 block overflow-hidden rounded-2xl border p-3 text-left transition hover:brightness-110',
        mine ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/8',
      )}
    >
      {safeImageUrl && imageVisible && (
        <img
          src={safeImageUrl}
          alt=""
          className="-mx-3 -mt-3 mb-3 aspect-[1.91/1] w-[calc(100%+1.5rem)] object-cover"
          onError={() => setImageVisible(false)}
        />
      )}
      <span className="flex items-center gap-2 text-xs font-black uppercase text-white/45">
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      {title && (
        <span className="mt-1 block truncate text-sm font-black text-white">
          {title}
        </span>
      )}
      {description && (
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">
          {description}
        </span>
      )}
      <span className="mt-2 block truncate text-[0.68rem] font-bold text-white/35">
        {displayUrl}
      </span>
    </a>
  );
}

function safeLinkPreviewUrl(value?: null | string): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function linkPreviewHostname(url: URL): string {
  return url.hostname;
}

function linkPreviewFaviconUrl(url: URL): string {
  return `${url.origin}/favicon.ico`;
}

function displayLinkPreviewUrl(url: URL): string {
  return `${url.hostname}${url.pathname}${url.search}`.replace(/\/$/, '');
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

function ImageAttachmentAlbum({
  items,
  mine,
  onOpen,
  onPreview,
}: {
  items: IndexedAttachment[];
  mine: boolean;
  onOpen: (images: LightboxImage[], index: number) => void;
  onPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
}) {
  const [previewUrls, setPreviewUrls] = useState<(null | string)[]>([]);
  const [progress, setProgress] = useState<AttachmentProgress | null>(null);
  const albumRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadPreviews, setShouldLoadPreviews] = useState(false);
  const visibleItems = items.length > 4 ? items.slice(0, 4) : items;
  const extraCount = items.length > 4 ? items.length - 3 : 0;
  const lightboxImages = items.flatMap(({ attachment }, index) => {
    const url = previewUrls[index];

    return url
      ? [
          {
            alt: attachment.filename,
            filename: attachment.filename,
            url,
          },
        ]
      : [];
  });

  useEffect(() => {
    const album = albumRef.current;

    if (!album || shouldLoadPreviews) return undefined;

    if (!('IntersectionObserver' in window)) {
      setShouldLoadPreviews(true);

      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setShouldLoadPreviews(true);
        observer.disconnect();
      },
      { rootMargin: '360px 0px' },
    );

    observer.observe(album);

    return () => observer.disconnect();
  }, [shouldLoadPreviews]);

  useEffect(() => {
    let cancelled = false;
    const loadedUrls: string[] = [];

    setPreviewUrls(Array(items.length).fill(null));
    setProgress(null);

    if (!shouldLoadPreviews) {
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      items.map(({ attachment }, index) =>
        onPreview(attachment, setProgress)
          .then((url) => {
            if (cancelled) {
              URL.revokeObjectURL(url);

              return;
            }

            loadedUrls.push(url);
            setPreviewUrls((current) => {
              const next = [...current];

              next[index] = url;

              return next;
            });
          })
          .catch(() => undefined),
      ),
    ).finally(() => {
      if (!cancelled) setProgress(null);
    });

    return () => {
      cancelled = true;
      loadedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [items, onPreview, shouldLoadPreviews]);

  return (
    <div
      ref={albumRef}
      className={cx(
        'overflow-hidden rounded-2xl border',
        mine ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/8',
      )}
    >
      <div
        className={cx(
          'grid gap-1',
          visibleItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
        )}
      >
        {visibleItems.map(({ attachment }, visibleIndex) => {
          const previewUrl = previewUrls[visibleIndex];
          const isOverflowTile = extraCount > 0 && visibleIndex === 3;
          const lightboxIndex = previewUrl
            ? lightboxImages.findIndex((image) => image.url === previewUrl)
            : -1;

          return (
            <button
              type="button"
              key={attachment.cid}
              onClick={() => {
                if (lightboxImages.length === 0 || lightboxIndex < 0) return;
                onOpen(lightboxImages, lightboxIndex);
              }}
              className={cx(
                'relative min-h-28 overflow-hidden bg-black/25 text-left transition hover:opacity-90',
                visibleItems.length === 1 ? 'aspect-[4/3]' : 'aspect-square',
              )}
              aria-label={copy.attachments.openImage}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center px-3 text-center text-xs font-black text-white/55">
                  {progress ? `${progress.percent}%` : attachment.filename}
                </div>
              )}
              {isOverflowTile && (
                <div className="absolute inset-0 grid place-items-center bg-black/65 text-3xl font-black text-white">
                  +{extraCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {progress && (
        <div className="px-3 py-2 text-xs font-black opacity-75">
          {progress.percent}%
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-fuchsia-400"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  mine,
  onClick,
  onPreview,
  pending,
}: {
  attachment: MessageAttachment;
  mine: boolean;
  onClick: () => void;
  onPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  pending?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<AttachmentProgress | null>(null);
  const hasPreview =
    !isLargeOrChunkedAttachment(attachment) &&
    (attachment.contentType.startsWith('video/') ||
      attachment.contentType.startsWith('audio/'));

  useEffect(() => {
    if (!hasPreview) return undefined;

    let cancelled = false;

    void onPreview(attachment, setProgress)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        setPreviewUrl(url);
        setProgress(null);
      })
      .catch(() => setProgress(null));

    return () => {
      cancelled = true;
    };
  }, [attachment, hasPreview, onPreview]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <div
      className={cx(
        'overflow-hidden rounded-2xl border text-left transition',
        mine
          ? 'border-white/20 bg-white/10 hover:bg-white/15'
          : 'border-white/10 bg-white/8 hover:bg-white/12',
      )}
    >
      {previewUrl && attachment.contentType.startsWith('video/') && (
        <video
          src={previewUrl}
          className="max-h-44 w-full sm:max-h-72"
          controls
        />
      )}
      {previewUrl && attachment.contentType.startsWith('audio/') && (
        <audio src={previewUrl} className="w-full p-1 sm:p-2" controls />
      )}
      {progress && (
        <div className="px-3 pt-3 text-xs font-black opacity-75">
          {progress.percent}%
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-fuchsia-400"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
      {!hasPreview && (
        <div className="grid min-h-20 place-items-center bg-black/20 p-3 sm:min-h-32 sm:p-4">
          <div className="relative h-12 w-9 rounded-lg border border-white/20 bg-white/10 sm:h-16 sm:w-12">
            <div className="absolute right-0 top-0 h-5 w-5 rounded-bl-lg border-b border-l border-white/20 bg-white/20" />
            <div className="absolute bottom-4 left-2 right-2 h-1 rounded-full bg-white/25" />
            <div className="absolute bottom-7 left-2 right-2 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={pending ? undefined : onClick}
        className={cx(
          'flex w-full max-w-full items-center gap-3 px-3 py-2 text-left',
          pending ? 'cursor-wait opacity-70' : 'cursor-pointer',
        )}
        aria-label={copy.attachments.download}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 font-black">
          ↓
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-black leading-tight">
            {attachment.filename}
          </span>
          <span className="block text-xs opacity-65">
            {formatFileSize(attachment.size)}
          </span>
        </span>
      </button>
    </div>
  );
}

function isImageAttachment(attachment: MessageAttachment): boolean {
  if (isLargeOrChunkedAttachment(attachment)) return false;

  return isBrowserPreviewImage(attachment.contentType);
}

function isLargeOrChunkedAttachment(attachment: MessageAttachment): boolean {
  return (
    attachment.type === 'chunked_file' ||
    !!attachment.chunks?.length ||
    attachment.size > 50 * 1024 * 1024
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
