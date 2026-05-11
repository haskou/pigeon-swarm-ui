import { useEffect, useMemo, useState } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';

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
  onAvatarClick: () => void;
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
  onAttachmentPreview,
  onAttachmentOpen,
  onAvatarClick,
  showAvatar,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;
  const compactTimestamp =
    message.content.length <= 36 && !message.content.includes('\n');
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const indexedAttachments = useMemo(
    () => message.attachments.map((attachment, index) => ({ attachment, index })),
    [message.attachments],
  );
  const imageAttachments = indexedAttachments.filter(({ attachment }) =>
    isImageAttachment(attachment),
  );
  const otherAttachments = indexedAttachments.filter(
    ({ attachment }) => !isImageAttachment(attachment),
  );

  return (
    <>
      <div className={cx('flex gap-3', mine && 'justify-end')}>
        {!mine &&
          (showAvatar ? (
            <Avatar
              label={authorName}
              onClick={onAvatarClick}
              picture={authorPicture}
            />
          ) : (
            <div className="w-11 shrink-0" />
          ))}
        <div
          className={cx(
            'max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]',
            compactTimestamp &&
              message.attachments.length === 0 &&
              'flex items-end gap-2',
            mine
              ? 'bg-fuchsia-500 text-right text-white shadow-xl shadow-fuchsia-950/20'
              : 'border border-white/10 bg-black/25 text-white',
          )}
        >
          {message.content && (
            <p className={cx(message.encrypted && 'text-white/55')}>
              {message.content}
            </p>
          )}
          {message.attachments.length > 0 && (
            <div className={cx(message.content && 'mt-3', 'grid gap-2')}>
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
                  onClick={() => onAttachmentOpen(index)}
                />
              ))}
            </div>
          )}
          <div
            className={cx(
              'text-right text-xs font-black opacity-65',
              compactTimestamp && message.attachments.length === 0
                ? 'shrink-0'
                : 'mt-1',
            )}
          >
            {formatTime(message.timestamp)}
          </div>
        </div>
        {mine &&
          (showAvatar ? (
            <Avatar
              label={authorName}
              mine
              onClick={onAvatarClick}
              picture={authorPicture}
            />
          ) : (
            <div className="w-11 shrink-0" />
          ))}
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
    let cancelled = false;
    const loadedUrls: string[] = [];

    setPreviewUrls(Array(items.length).fill(null));
    setProgress(null);
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
  }, [items, onPreview]);

  return (
    <div
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
}: {
  attachment: MessageAttachment;
  mine: boolean;
  onClick: () => void;
  onPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<AttachmentProgress | null>(null);
  const hasPreview =
    attachment.contentType.startsWith('video/') ||
    attachment.contentType.startsWith('audio/');

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
        <video src={previewUrl} className="max-h-72 w-full" controls />
      )}
      {previewUrl && attachment.contentType.startsWith('audio/') && (
        <audio src={previewUrl} className="w-full p-2" controls />
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
      <button
        type="button"
        onClick={onClick}
        className="flex w-full max-w-full items-center gap-3 px-3 py-2 text-left"
        aria-label={copy.attachments.download}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 font-black">
          ↓
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black">
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
  return attachment.contentType.startsWith('image/');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
