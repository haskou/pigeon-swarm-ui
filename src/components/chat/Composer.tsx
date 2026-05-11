import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

import type { AttachmentProgress } from '../../domain/types';

import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';

const MESSAGE_MAX_LENGTH = 4000;
const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

interface ComposerProps {
  disabled: boolean;
  error: string | null;
  onSend: (content: string, attachments: File[]) => Promise<void>;
  placeholder?: string;
  progress?: AttachmentProgress | null;
}

export function Composer({
  disabled,
  error,
  onSend,
  placeholder = copy.composer.placeholder,
  progress,
}: ComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<
    { file: File; previewUrl: string }[]
  >([]);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const attachmentsRef = useRef(attachments);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend =
    (content.trim().length > 0 || attachments.length > 0) &&
    content.trim().length <= MESSAGE_MAX_LENGTH &&
    !disabled &&
    !sending;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachment) =>
        URL.revokeObjectURL(attachment.previewUrl),
      );
    },
    [],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();

    if (!canSend) return;

    setSending(true);
    try {
      await onSend(
        trimmed,
        attachments.map((attachment) => attachment.file),
      );
      setContent('');
      attachments.forEach((attachment) =>
        URL.revokeObjectURL(attachment.previewUrl),
      );
      setAttachments([]);
      setAttachmentError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setSending(false);
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const acceptedFiles = selectedFiles.filter(
      (file) => file.size <= ATTACHMENT_MAX_BYTES,
    );

    setAttachmentError(
      acceptedFiles.length === selectedFiles.length
        ? null
        : copy.composer.attachmentTooLarge,
    );
    setAttachments((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    event.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((current) =>
      current.filter((attachment, index) => {
        if (index === indexToRemove) {
          URL.revokeObjectURL(attachment.previewUrl);
          return false;
        }

        return true;
      }),
    );
  };
  const imageAttachments = attachments
    .map((attachment, index) => ({ ...attachment, index }))
    .filter(({ file }) => isBrowserPreviewImage(file.type));
  const otherAttachments = attachments
    .map((attachment, index) => ({ ...attachment, index }))
    .filter(({ file }) => !isBrowserPreviewImage(file.type));
  const lightboxImages = imageAttachments.map(({ file, previewUrl }) => ({
    alt: file.name,
    filename: file.name,
    url: previewUrl,
  }));

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 p-4 sm:p-5"
      >
        {(error || attachmentError) && (
          <div className="mb-3 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error ?? attachmentError}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {imageAttachments.length > 0 && (
              <ComposerImageAlbum
                attachments={imageAttachments}
                disabled={disabled || sending}
                lightboxImages={lightboxImages}
                onOpen={(index) => setLightbox({ images: lightboxImages, index })}
                onRemove={removeAttachment}
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
                    onClick={() => removeAttachment(attachment.index)}
                    disabled={disabled || sending}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/10 font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed"
                    aria-label={copy.composer.removeAttachment}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {progress && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/70">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">
                {progress.phase === 'encrypt'
                  ? copy.composer.encryptingAttachment
                  : copy.composer.decryptingAttachment}{' '}
                {progress.filename}
              </span>
              <span className="shrink-0 font-black">{progress.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-fuchsia-400"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
        <div
          className={cx(
            'flex items-center gap-2 rounded-3xl border border-white/10 bg-black/20 p-2 transition',
            disabled && 'cursor-not-allowed opacity-45',
          )}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || sending}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/70 disabled:cursor-not-allowed"
            aria-label={copy.composer.attach}
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={disabled || sending}
            maxLength={MESSAGE_MAX_LENGTH}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed"
            placeholder={placeholder}
          />
          <span className="hidden min-w-12 text-right text-xs font-black text-white/35 sm:block">
            {content.length}/{MESSAGE_MAX_LENGTH}
          </span>
          <button
            disabled={!canSend}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {sending ? copy.composer.sending : copy.composer.send}
          </button>
        </div>
      </form>
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
              className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/10 font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed"
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
  if (isBrowserPreviewImage(file.type)) {
    return <img src={url} alt="" className="h-28 w-56 object-cover" />;
  }

  if (file.type.startsWith('video/')) {
    return (
      <video
        src={url}
        className="h-28 w-56 object-cover"
        controls
        muted
      />
    );
  }

  if (file.type.startsWith('audio/')) {
    return <audio src={url} className="w-56 p-2" controls />;
  }

  return (
    <div className="grid h-28 w-56 place-items-center bg-black/20 p-4">
      <div className="relative h-16 w-12 rounded-lg border border-white/20 bg-white/10">
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
