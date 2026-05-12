import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { AttachmentProgress, ChatMessage } from '../../domain/types';

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
  replyTo?: ChatMessage | null;
  replyToAuthorName?: string;
  onCancelReply?: () => void;
}

export function Composer({
  disabled,
  error,
  onSend,
  placeholder = copy.composer.placeholder,
  progress,
  replyTo,
  replyToAuthorName,
  onCancelReply,
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
  const [draggingFiles, setDraggingFiles] = useState(false);
  const attachmentsRef = useRef(attachments);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const canAttach = !disabled && !sending;
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

  useEffect(() => {
    if (!replyTo || disabled || sending) return;

    textInputRef.current?.focus();
  }, [disabled, replyTo, sending]);

  const addFiles = useCallback((selectedFiles: File[]) => {
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
  }, []);

  useEffect(() => {
    if (!canAttach) {
      dragDepthRef.current = 0;
      setDraggingFiles(false);
      return;
    }

    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setDraggingFiles(false);
    };
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      dragDepthRef.current += 1;
      setDraggingFiles(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      event.dataTransfer!.dropEffect = 'copy';
      setDraggingFiles(true);
    };
    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDraggingFiles(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;

      event.preventDefault();
      addFiles(Array.from(event.dataTransfer?.files ?? []));
      resetDragState();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [addFiles, canAttach]);

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
      window.setTimeout(() => textInputRef.current?.focus(), 0);
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
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
        {replyTo && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/15 p-3 text-sm text-fuchsia-50">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-fuchsia-100/70">
                {copy.messages.replyingTo}{' '}
                {replyToAuthorName ?? replyTo.authorIdentityId}
              </div>
              {replyTo.content && (
                <div className="mt-1 truncate text-white/80">
                  {replyTo.content}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 font-black text-white/80 transition hover:bg-white/15"
              aria-label={copy.messages.cancelReply}
            >
              ×
            </button>
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
            ref={textInputRef}
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
      {draggingFiles &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[140] grid place-items-center bg-black/70 p-6 backdrop-blur-md">
            <div className="grid h-full w-full place-items-center rounded-[2rem] border-2 border-dashed border-fuchsia-300/70 bg-fuchsia-500/10 text-center shadow-2xl shadow-black/40">
              <div>
                <div className="text-4xl font-black text-white">+</div>
                <div className="mt-3 text-2xl font-black text-white">
                  {copy.composer.dropFiles}
                </div>
              </div>
            </div>
          </div>,
          document.body,
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
