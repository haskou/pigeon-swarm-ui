import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';

import type { AttachmentProgress } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

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

  return (
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
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.file.name}-${attachment.file.size}-${index}`}
              className="max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-xs text-white/70"
            >
              <AttachmentPreview file={attachment.file} url={attachment.previewUrl} />
              <div className="flex max-w-56 items-center gap-2 px-3 py-2">
                <span className="truncate">{attachment.file.name}</span>
                <span className="shrink-0 text-white/35">
                  {formatFileSize(attachment.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
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
  );
}

function AttachmentPreview({ file, url }: { file: File; url: string }) {
  if (file.type.startsWith('image/')) {
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

  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
