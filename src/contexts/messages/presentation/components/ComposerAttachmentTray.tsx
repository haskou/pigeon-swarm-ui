import { useMemo, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { isBrowserPreviewFile } from '../../../../shared/presentation/isBrowserPreviewFile';
import { cx } from '../../../../shared/presentation/cx';
import type { LightboxImage } from './imageLightbox';
import { LazyImageLightbox } from './LazyImageLightbox';

interface ComposerAttachment {
  file: File;
  previewUrl: string;
}

interface ComposerAttachmentTrayProps {
  attachments: ComposerAttachment[];
  disabled: boolean;
  onRemove: (index: number) => void;
}

export function ComposerAttachmentTray({
  attachments,
  disabled,
  onRemove,
}: ComposerAttachmentTrayProps) {
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const indexedAttachments = useMemo(
    () => attachments.map((attachment, index) => ({ ...attachment, index })),
    [attachments],
  );
  const imageAttachments = useMemo(
    () =>
      indexedAttachments.filter(({ file }) => isBrowserPreviewFile(file)),
    [indexedAttachments],
  );
  const otherAttachments = useMemo(
    () =>
      indexedAttachments.filter(
        ({ file }) => !isBrowserPreviewFile(file),
      ),
    [indexedAttachments],
  );
  const lightboxImages = useMemo(
    () =>
      imageAttachments.map(({ file, previewUrl }) => ({
        alt: file.name,
        filename: file.name,
        url: previewUrl,
      })),
    [imageAttachments],
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {imageAttachments.length > 0 && (
          <ComposerImageAlbum
            attachments={imageAttachments}
            disabled={disabled}
            lightboxImages={lightboxImages}
            onOpen={(index) => setLightbox({ images: lightboxImages, index })}
            onRemove={onRemove}
          />
        )}
        {otherAttachments.map((attachment) => (
          <div
            key={`${attachment.file.name}-${attachment.file.size}-${attachment.index}`}
            className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-xs text-white/70"
          >
            <AttachmentPreview
              file={attachment.file}
              url={attachment.previewUrl}
            />
            <div className="flex max-w-56 items-center gap-2 px-3 py-2">
              <span className="truncate">{attachment.file.name}</span>
              <span className="shrink-0 text-white/35">
                {formatFileSize(attachment.file.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(attachment.index)}
                disabled={disabled}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed"
                aria-label={copy.composer.removeAttachment}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      {lightbox && (
        <LazyImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function ComposerImageAlbum({
  attachments,
  disabled,
  lightboxImages,
  onOpen,
  onRemove,
}: {
  attachments: { file: File; index: number; previewUrl: string }[];
  disabled: boolean;
  lightboxImages: LightboxImage[];
  onOpen: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const visibleAttachments =
    attachments.length > 4 ? attachments.slice(0, 4) : attachments;
  const extraCount = attachments.length > 4 ? attachments.length - 3 : 0;

  return (
    <div className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-xs text-white/70">
      <div
        className={cx(
          'grid w-56 gap-1',
          visibleAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
        )}
      >
        {visibleAttachments.map((attachment, visibleIndex) => {
          const isOverflowTile = extraCount > 0 && visibleIndex === 3;

          return (
            <button
              type="button"
              key={`${attachment.file.name}-${attachment.file.size}-${attachment.index}`}
              onClick={() =>
                onOpen(Math.min(visibleIndex, lightboxImages.length - 1))
              }
              className={cx(
                'relative overflow-hidden bg-black/25 hover:opacity-90',
                visibleAttachments.length === 1
                  ? 'h-28'
                  : 'aspect-square min-h-24',
              )}
              aria-label={copy.attachments.openImage}
            >
              <img
                src={attachment.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              {isOverflowTile && (
                <div className="absolute inset-0 grid place-items-center bg-black/65 text-3xl font-black text-white">
                  +{extraCount}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid gap-1 px-3 py-2">
        {attachments.map((attachment) => (
          <div
            key={`${attachment.file.name}-${attachment.file.size}-${attachment.index}`}
            className="flex max-w-56 items-center gap-2"
          >
            <span className="truncate">{attachment.file.name}</span>
            <span className="shrink-0 text-white/35">
              {formatFileSize(attachment.file.size)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(attachment.index)}
              disabled={disabled}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed"
              aria-label={copy.composer.removeAttachment}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentPreview({ file, url }: { file: File; url: string }) {
  if (isBrowserPreviewFile(file)) {
    return <img src={url} alt="" className="h-28 w-56 object-cover" />;
  }

  if (file.type.startsWith('video/')) {
    return (
      <video src={url} className="h-28 w-56 object-cover" controls muted />
    );
  }

  if (file.type.startsWith('audio/')) {
    return <audio src={url} className="w-56 p-2" controls />;
  }

  return (
    <div className="grid h-28 w-56 place-items-center bg-black/20 p-4">
      <div className="relative h-16 w-12 rounded-2xl border border-white/20 bg-white/10">
        <div className="absolute right-0 top-0 h-5 w-5 rounded-bl-lg border-b border-l border-white/20 bg-white/20" />
        <div className="absolute bottom-4 left-2 right-2 h-1 rounded-full bg-white/25" />
        <div className="absolute bottom-7 left-2 right-2 h-1 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
