import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AttachmentProgress,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import type { LightboxImage } from './imageLightbox';
import { MessageAttachmentPreview } from './MessageAttachmentPreview';
import { visibleImageAlbumItems } from './visibleImageAlbumItems';

const previewViewportMargin = 360;
export const imageAttachmentAlbumWidthClass =
  'w-[min(72vw,24rem)] max-w-full sm:w-[min(42vw,24rem)]';

export type IndexedAttachment = {
  attachment: MessageAttachment;
  index: number;
};

export function ImageAttachmentAlbum({
  contained = false,
  encryptedEnvironment = false,
  items,
  mine,
  onMenuOpen,
  onOpen,
  onPreview,
}: {
  contained?: boolean;
  encryptedEnvironment?: boolean;
  items: IndexedAttachment[];
  mine: boolean;
  onMenuOpen?: (event: MouseEvent<HTMLElement>) => void;
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
  const visibleItems = useMemo(() => visibleImageAlbumItems(items), [items]);
  const extraCount = items.length > 4 ? items.length - 3 : 0;
  const lightboxImages = items.flatMap(({ attachment }, index) => {
    const url = previewUrls[index];

    return url
      ? [
          {
            alt: attachment.filename,
            attachment,
            filename: attachment.filename,
            url,
          },
        ]
      : [];
  });

  useEffect(() => {
    const album = albumRef.current;

    if (!album || shouldLoadPreviews) return undefined;

    if (isNearPreviewViewport(album)) {
      setShouldLoadPreviews(true);

      return undefined;
    }

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
      { rootMargin: `${previewViewportMargin}px 0px` },
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
        onPreview(attachment.preview ?? attachment, setProgress)
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
        contained ? 'w-full max-w-full' : imageAttachmentAlbumWidthClass,
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
          const publicUnencrypted =
            encryptedEnvironment && isPublicUnencryptedAttachment(attachment);

          return (
            <div
              key={attachment.cid}
              className={cx(
                'relative w-full min-w-0 overflow-hidden rounded-2xl bg-black/25 text-left',
                visibleItems.length === 1 ? 'aspect-[4/3]' : 'aspect-square',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (lightboxImages.length === 0 || lightboxIndex < 0) return;
                  onOpen(lightboxImages, lightboxIndex);
                }}
                className="h-full w-full transition hover:opacity-90"
                aria-label={copy.attachments.openImage}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    decoding="async"
                    loading="lazy"
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <ImageAttachmentSkeleton progress={progress} />
                )}
                {isOverflowTile && (
                  <div className="absolute inset-0 grid place-items-center bg-black/65 text-3xl font-black text-white">
                    +{extraCount}
                  </div>
                )}
              </button>
              <PublicMediaControls
                attachment={attachment}
                encryptedEnvironment={encryptedEnvironment}
                onMenuOpen={onMenuOpen}
              />
              {onMenuOpen && !publicUnencrypted ? (
                <ImageAttachmentMenuButton onMenuOpen={onMenuOpen} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AttachmentCard({
  attachment,
  encryptedEnvironment = false,
  mine,
  onClick,
  onPreview,
  pending,
}: {
  attachment: MessageAttachment;
  encryptedEnvironment?: boolean;
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
  const [shouldLoadPreview, setShouldLoadPreview] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hasPreview =
    !MessageAttachmentPreview.isLargeOrChunked(attachment) &&
    (attachment.contentType.startsWith('video/') ||
      attachment.contentType.startsWith('audio/'));

  useEffect(() => {
    const card = cardRef.current;

    if (!card || shouldLoadPreview || !hasPreview) return undefined;

    if (isNearPreviewViewport(card)) {
      setShouldLoadPreview(true);

      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldLoadPreview(true);

      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setShouldLoadPreview(true);
        observer.disconnect();
      },
      { rootMargin: `${previewViewportMargin}px 0px` },
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, [hasPreview, shouldLoadPreview]);

  useEffect(() => {
    if (!hasPreview || !shouldLoadPreview) return undefined;

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
  }, [attachment, hasPreview, onPreview, shouldLoadPreview]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <div
      ref={cardRef}
      className={cx(
        'relative overflow-hidden rounded-2xl border text-left transition',
        mine
          ? 'border-white/20 bg-white/10 hover:bg-white/15'
          : 'border-white/10 bg-white/8 hover:bg-white/12',
      )}
    >
      <PublicMediaControls
        attachment={attachment}
        encryptedEnvironment={encryptedEnvironment}
      />
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
      {hasPreview && !previewUrl && (
        <AttachmentPreviewSkeleton
          mediaType={attachment.contentType.startsWith('audio/') ? 'audio' : 'video'}
          progress={progress}
        />
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

export function VideoAttachmentCard({
  attachment,
  contained = false,
  encryptedEnvironment = false,
  mine,
  onPreview,
  pending,
}: {
  attachment: MessageAttachment;
  contained?: boolean;
  encryptedEnvironment?: boolean;
  mine: boolean;
  onPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  pending?: boolean;
}) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<AttachmentProgress | null>(null);
  const [shouldLoadPreview, setShouldLoadPreview] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const largeOrChunked = MessageAttachmentPreview.isLargeOrChunked(attachment);
  const posterAttachment = largeOrChunked ? attachment.preview : undefined;

  useEffect(() => {
    const card = cardRef.current;

    if (!card || shouldLoadPreview) return undefined;

    if (isNearPreviewViewport(card)) {
      setShouldLoadPreview(true);

      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldLoadPreview(true);

      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        setShouldLoadPreview(true);
        observer.disconnect();
      },
      { rootMargin: `${previewViewportMargin}px 0px` },
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, [shouldLoadPreview]);

  useEffect(() => {
    if (!shouldLoadPreview) return undefined;

    let cancelled = false;

    if (largeOrChunked) {
      if (!posterAttachment) return undefined;

      void onPreview(posterAttachment)
        .then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url);

            return;
          }

          setPosterUrl(url);
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    }

    void onPreview(attachment, setProgress)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        setVideoUrl(url);
        setProgress(null);
      })
      .catch(() => setProgress(null));

    return () => {
      cancelled = true;
    };
  }, [attachment, largeOrChunked, onPreview, posterAttachment, shouldLoadPreview]);

  useEffect(
    () => () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [posterUrl, videoUrl],
  );

  const loadVideo = () => {
    if (pending || videoUrl) return;

    setProgress(null);
    void onPreview(attachment, setProgress)
      .then((url) => {
        setVideoUrl(url);
        setProgress(null);
      })
      .catch(() => setProgress(null));
  };

  return (
    <div
      ref={cardRef}
      className={cx(
        'relative overflow-hidden rounded-2xl border',
        contained ? 'w-full max-w-full' : imageAttachmentAlbumWidthClass,
        mine ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/8',
      )}
    >
      <PublicMediaControls
        attachment={attachment}
        encryptedEnvironment={encryptedEnvironment}
      />
      {videoUrl ? (
        <video
          autoPlay={largeOrChunked}
          controls
          poster={posterUrl ?? undefined}
          preload="metadata"
          src={videoUrl}
          className="max-h-80 w-full bg-black object-contain"
        />
      ) : largeOrChunked ? (
        <button
          type="button"
          disabled={pending}
          onClick={loadVideo}
          className={cx(
            'group relative aspect-video w-full overflow-hidden bg-black/25 text-left',
            pending ? 'cursor-wait opacity-70' : 'cursor-pointer',
          )}
          aria-label={copy.attachments.previewVideo}
        >
          {posterUrl ? (
            <img
              alt=""
              decoding="async"
              loading="lazy"
              src={posterUrl}
              className="h-full w-full object-cover opacity-80 transition group-hover:opacity-95"
            />
          ) : (
            <AttachmentPreviewSkeleton mediaType="video" progress={progress} />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <span className="flex items-center gap-3 rounded-full bg-black/65 px-4 py-2 text-sm font-black text-white shadow-xl shadow-black/40">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-950">
                ▶
              </span>
              <span>
                {copy.attachments.previewVideo}
                <span className="block text-xs text-white/60">
                  {formatFileSize(attachment.size)}
                </span>
              </span>
            </span>
          </span>
          {progress && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-1 text-[0.65rem] font-black text-white/75">
              {progress.percent}%
            </span>
          )}
        </button>
      ) : (
        <AttachmentPreviewSkeleton mediaType="video" progress={progress} />
      )}
    </div>
  );
}

function PublicMediaControls({
  attachment,
  encryptedEnvironment,
  onMenuOpen,
}: {
  attachment: MessageAttachment;
  encryptedEnvironment: boolean;
  onMenuOpen?: (event: MouseEvent<HTMLElement>) => void;
}) {
  if (!isPublicUnencryptedAttachment(attachment) || !encryptedEnvironment) {
    return null;
  }

  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
      {onMenuOpen ? (
        <button
          type="button"
          onClick={onMenuOpen}
          className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200/60 bg-rose-500/45 text-rose-50 shadow-lg shadow-black/45 transition hover:bg-rose-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-100/60"
          title={copy.attachments.publicUnencrypted}
          aria-label={copy.attachments.publicUnencrypted}
        >
          <OpenLockIcon />
        </button>
      ) : (
        <span
          className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200/60 bg-rose-500/45 text-rose-50 shadow-lg shadow-black/45"
          title={copy.attachments.publicUnencrypted}
          aria-label={copy.attachments.publicUnencrypted}
        >
          <OpenLockIcon />
        </span>
      )}
    </div>
  );
}

function ImageAttachmentMenuButton({
  onMenuOpen,
}: {
  onMenuOpen: (event: MouseEvent<HTMLElement>) => void;
}) {
  const coarsePointer = useCoarsePointer();

  return (
    <button
      type="button"
      onClick={onMenuOpen}
      className={cx(
        'absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/55 text-white shadow-lg shadow-black/35 backdrop-blur-md transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        coarsePointer ? '' : 'sm:hidden',
      )}
      aria-label={copy.messages.openMenu}
    >
      <MoreDotsIcon />
    </button>
  );
}

function useCoarsePointer(): boolean {
  const [coarsePointer, setCoarsePointer] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(pointer: coarse)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarsePointer(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  return coarsePointer;
}

function MoreDotsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M5 12h.01M12 12h.01M19 12h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function OpenLockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M9 10V8a5 5 0 0 1 8.7-3.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 14v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function isPublicUnencryptedAttachment(
  attachment: MessageAttachment,
): boolean {
  return (
    attachment.storage === 'public' ||
    (attachment.storage !== 'private' &&
      attachment.encrypted === false &&
      !attachment.encryption)
  );
}

export function isImageAttachment(attachment: MessageAttachment): boolean {
  return MessageAttachmentPreview.isImage(attachment);
}

export function isAudioAttachment(attachment: MessageAttachment): boolean {
  return attachment.contentType.toLowerCase().startsWith('audio/');
}

export function isVideoAttachment(attachment: MessageAttachment): boolean {
  return attachment.contentType.toLowerCase().startsWith('video/');
}

function ImageAttachmentSkeleton({
  progress,
}: {
  progress: AttachmentProgress | null;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white/7">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/14 via-white/8 to-transparent" />
      <div className="absolute left-4 top-4 h-8 w-8 rounded-full bg-white/15" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/14 to-transparent" />
      <div className="absolute bottom-4 left-4 right-10 h-3 rounded-full bg-white/16" />
      <div className="absolute bottom-9 left-4 h-3 w-1/2 rounded-full bg-white/12" />
      {progress && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[0.65rem] font-black text-white/75">
          {progress.percent}%
        </div>
      )}
    </div>
  );
}

function AttachmentPreviewSkeleton({
  mediaType,
  progress,
}: {
  mediaType: 'audio' | 'video';
  progress: AttachmentProgress | null;
}) {
  if (mediaType === 'audio') {
    return (
      <div className="flex min-h-16 items-center gap-3 bg-black/20 px-3 py-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/12" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-white/14" />
          <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
        </div>
        {progress && (
          <span className="text-xs font-black text-white/55">
            {progress.percent}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black/25">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/12 via-white/7 to-transparent" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-12 w-16 rounded-2xl bg-white/12" />
      </div>
      {progress && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-1 text-[0.65rem] font-black text-white/75">
          {progress.percent}%
        </div>
      )}
    </div>
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function isNearPreviewViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();

  return (
    rect.bottom >= -previewViewportMargin &&
    rect.top <= window.innerHeight + previewViewportMargin &&
    rect.right >= -previewViewportMargin &&
    rect.left <= window.innerWidth + previewViewportMargin
  );
}
