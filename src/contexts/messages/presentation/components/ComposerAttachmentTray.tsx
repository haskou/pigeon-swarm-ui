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
    () => indexedAttachments.filter(({ file }) => isBrowserPreviewFile(file)),
    [indexedAttachments],
  );
  const otherAttachments = useMemo(
    () => indexedAttachments.filter(({ file }) => !isBrowserPreviewFile(file)),
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
  const totalSize = useMemo(
    () => attachments.reduce((total, { file }) => total + file.size, 0),
    [attachments],
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <span className="text-xs font-bold text-white/65">
            {copy.composer.selectedAttachments.replace(
              '{count}',
              String(attachments.length),
            )}
          </span>
          <span className="shrink-0 text-xs text-white/35">
            {formatFileSize(totalSize)}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {imageAttachments.length > 0 && (
            <ComposerImageGrid
              attachments={imageAttachments}
              disabled={disabled}
              onOpen={(index) => setLightbox({ images: lightboxImages, index })}
              onRemove={onRemove}
            />
          )}
          {otherAttachments.length > 0 && (
            <div
              className={cx(
                'divide-y divide-white/10',
                imageAttachments.length > 0 && 'mt-2 border-t border-white/10',
              )}
            >
              {otherAttachments.map((attachment) => (
                <ComposerFileRow
                  attachment={attachment}
                  disabled={disabled}
                  key={`${attachment.file.name}-${attachment.file.size}-${attachment.index}`}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>
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

function ComposerImageGrid({
  attachments,
  disabled,
  onOpen,
  onRemove,
}: {
  attachments: { file: File; index: number; previewUrl: string }[];
  disabled: boolean;
  onOpen: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      className={cx(
        'grid gap-2',
        attachments.length === 1
          ? 'max-w-xs grid-cols-1'
          : 'grid-cols-2 sm:grid-cols-3',
      )}
    >
      {attachments.map((attachment, visibleIndex) => (
        <article
          key={`${attachment.file.name}-${attachment.file.size}-${attachment.index}`}
          className="group relative min-w-0 overflow-hidden rounded-md bg-black/30"
        >
          <button
            type="button"
            onClick={() => onOpen(visibleIndex)}
            className="block aspect-[4/3] w-full overflow-hidden"
            aria-label={copy.attachments.openImage}
          >
            <img
              src={attachment.previewUrl}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 text-left">
            <div className="truncate text-[0.65rem] font-bold text-white">
              {attachment.file.name}
            </div>
            <div className="text-[0.6rem] text-white/55">
              {formatFileSize(attachment.file.size)}
            </div>
          </div>
          <RemoveAttachmentButton
            disabled={disabled}
            onClick={() => onRemove(attachment.index)}
          />
        </article>
      ))}
    </div>
  );
}

function ComposerFileRow({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: ComposerAttachment & { index: number };
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="grid gap-2 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <AttachmentPreview file={attachment.file} url={attachment.previewUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-white/75">
            {attachment.file.name}
          </div>
          <div className="mt-0.5 text-[0.65rem] text-white/35">
            {attachment.file.type || copy.attachments.file} ·{' '}
            {formatFileSize(attachment.file.size)}
          </div>
        </div>
        <RemoveAttachmentButton
          disabled={disabled}
          onClick={() => onRemove(attachment.index)}
          overlay={false}
        />
      </div>
      {attachment.file.type.startsWith('audio/') && (
        <audio src={attachment.previewUrl} className="h-8 w-full" controls />
      )}
    </div>
  );
}

function RemoveAttachmentButton({
  disabled,
  onClick,
  overlay = true,
}: {
  disabled: boolean;
  onClick: () => void;
  overlay?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cx(
        'grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-[#171923]/90 text-sm font-bold text-white/75 transition hover:bg-rose-500/25 hover:text-white disabled:cursor-not-allowed',
        overlay && 'absolute right-1.5 top-1.5',
      )}
      aria-label={copy.composer.removeAttachment}
      title={copy.composer.removeAttachment}
    >
      ×
    </button>
  );
}

function AttachmentPreview({ file, url }: { file: File; url: string }) {
  if (file.type.startsWith('video/')) {
    return (
      <video
        src={url}
        className="h-12 w-16 shrink-0 rounded-md bg-black object-cover"
        muted
      />
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-white/[0.06]">
      <div className="relative h-7 w-5 rounded-sm border border-white/25 bg-white/10">
        <div className="absolute right-0 top-0 h-2 w-2 rounded-bl-sm border-b border-l border-white/20 bg-white/20" />
        <div className="absolute bottom-1.5 left-1 right-1 h-px bg-white/25" />
        <div className="absolute bottom-3 left-1 right-1 h-px bg-white/20" />
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
