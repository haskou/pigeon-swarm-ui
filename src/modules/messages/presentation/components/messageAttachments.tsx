import { useEffect, useRef, useState } from 'react';

import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { isBrowserPreviewImage } from '../../../../shared/presentation/isBrowserPreviewImage';
import { cx } from '../../../../shared/presentation/cx';
import type { LightboxImage } from './imageLightbox';

export type IndexedAttachment = {
  attachment: MessageAttachment;
  index: number;
};

export function ImageAttachmentAlbum({
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

export function AttachmentCard({
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

export function isImageAttachment(attachment: MessageAttachment): boolean {
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
