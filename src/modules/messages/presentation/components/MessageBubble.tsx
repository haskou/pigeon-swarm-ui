import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { formatTime } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { Avatar } from './Avatar';
import { CallEventMessage } from './CallEventMessage';
import { ImageLightbox, type LightboxImage } from './imageLightbox';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MarkdownMessage, type MarkdownMention } from './markdownMessage';
import { PinIcon, ThreadIcon } from './messageActionIcons';
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
  onAvatarClick?: (event: MouseEvent<HTMLElement>) => void;
  onMessageClick?: (message: ChatMessage) => void;
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
  onThreadOpen?: (message: ChatMessage) => void;
  pinned?: boolean;
  reactionAuthorNames?: Record<string, string>;
  mentionTokens?: MarkdownMention[];
  mentionHighlighted?: boolean;
  replyImage?: MessageAttachment;
  replyAuthorName?: string;
  replyPreview?: string;
  replySticker?: StickerMessageReference;
  reserveAvatarSpace?: boolean;
  showReplyPreview?: boolean;
  showAvatar: boolean;
  threadAuthorName?: string;
  threadAuthorPicture?: string | null;
  threadCount?: number;
}

export function MessageBubble({
  authorName,
  authorPicture,
  currentIdentityId,
  message,
  onAttachmentOpen,
  onAttachmentPreview,
  onAvatarClick,
  onMessageClick,
  onMessageMenuOpen,
  onMentionClick,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  onThreadOpen,
  pinned = false,
  reactionAuthorNames = {},
  mentionTokens = [],
  mentionHighlighted = false,
  replyAuthorName,
  replyImage,
  replyPreview,
  replySticker,
  reserveAvatarSpace = true,
  showReplyPreview = true,
  showAvatar,
  threadAuthorName,
  threadAuthorPicture,
  threadCount = 0,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;
  const callEvent =
    message.raw.type === 'call_event' || message.kind === 'call-event';
  const replyMessageId =
    message.replyPreview?.messageId ?? message.replyToMessageId;
  const hasReply = showReplyPreview && Boolean(replyMessageId);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const [originalMessageOpen, setOriginalMessageOpen] = useState(false);
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
  const canViewOriginalMessage = Boolean(message.originalContent && !sticker);
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
  useEffect(() => {
    setOriginalMessageOpen(false);
  }, [message.editMessageId, message.id]);

  const clearLongPressTimer = () => {
    if (!longPressTimerRef.current) return;

    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    onMessageMenuOpen(message, event.clientX, event.clientY);
  };
  const handleMessageClick = (event: MouseEvent<HTMLElement>) => {
    if (!onMessageClick) return;

    const target = event.target;
    const interactiveElement =
      target instanceof HTMLElement
        ? target.closest('a,button,input,textarea,select,[role="button"]')
        : null;

    if (interactiveElement && interactiveElement !== event.currentTarget) {
      return;
    }

    onMessageClick(message);
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
        className="min-w-0"
      >
        <div
          className={cx(
            'flex min-w-0 items-end gap-3',
            mine && 'justify-end',
          )}
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
                data-message-bubble
                onClick={handleMessageClick}
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
                  onMessageClick && 'cursor-pointer',
                  message.deliveryStatus === 'pending' && 'opacity-70',
                  sticker
                    ? 'rounded-2xl bg-transparent p-0'
                    : cx(
                        'rounded-2xl p-3',
                        mine
                          ? 'bg-[#274279] text-left text-white shadow-xl shadow-[#102938]/25'
                          : mentionHighlighted
                            ? 'border border-fuchsia-300/45 bg-fuchsia-600/90 text-white shadow-xl shadow-fuchsia-950/30'
                            : 'border border-white/10 bg-black/25 text-white',
                      ),
                )}
              >
                {pinned && !sticker && <PinnedMessageMarker />}
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
                        onOpen={(images, index) =>
                          setLightbox({ images, index })
                        }
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
                {message.edited && !sticker && (
                  <div className="mt-1 flex w-full justify-end">
                    {canViewOriginalMessage ? (
                      <button
                        type="button"
                        onClick={() => setOriginalMessageOpen(true)}
                        className="text-[0.65rem] font-black uppercase text-white/45 transition hover:text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                      >
                        {copy.messages.edited}
                      </button>
                    ) : (
                      <span className="text-[0.65rem] font-black uppercase text-white/45">
                        {copy.messages.edited}
                      </span>
                    )}
                  </div>
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
        {threadCount > 0 && onThreadOpen && (
          <div
            className={cx(
              'mt-2 flex min-w-0',
              mine ? 'justify-end' : reserveAvatarSpace ? 'pl-14' : '',
            )}
          >
            <MessageThreadLink
              authorName={threadAuthorName}
              authorPicture={threadAuthorPicture}
              count={threadCount}
              onClick={() => onThreadOpen(message)}
            />
          </div>
        )}
      </div>
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
      {originalMessageOpen && message.originalContent && (
        <OriginalMessageDialog
          content={message.originalContent}
          onClose={() => setOriginalMessageOpen(false)}
        />
      )}
    </>
  );
}

function PinnedMessageMarker() {
  return (
    <div className="mb-1 flex justify-end">
      <span
        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-black uppercase text-white/55"
        title={copy.messages.pinned}
      >
        <PinIcon className="h-3 w-3" />
        {copy.messages.pinned}
      </span>
    </div>
  );
}

function MessageThreadLink({
  authorName,
  authorPicture,
  count,
  onClick,
}: {
  authorName?: string;
  authorPicture?: string | null;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1.5 text-left text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      {authorPicture ? (
        <img
          alt=""
          src={authorPicture}
          className="h-5 w-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/12 text-[0.6rem] font-black text-white/60">
          {(authorName ?? copy.messages.thread).slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate">
        {count}{' '}
        {count === 1
          ? copy.messages.threadMessage
          : copy.messages.threadMessages}
      </span>
      <ThreadIcon className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

function OriginalMessageDialog({
  content,
  onClose,
}: {
  content: string;
  onClose: () => void;
}) {
  useCloseOnEscape(onClose);

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section
        aria-label={copy.messages.originalMessage}
        aria-modal="true"
        role="dialog"
        className="glass-panel-strong relative z-10 flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">
            {copy.messages.originalMessage}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/70 transition hover:bg-white/15"
            aria-label={copy.dialog.close}
          >
            &times;
          </button>
        </div>
        <div className="mt-4 min-h-0 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/35 p-4 text-sm leading-6 text-white/80">
          {content}
        </div>
      </section>
    </div>,
    document.body,
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
  onAvatarClick?: (event: MouseEvent<HTMLElement>) => void;
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
