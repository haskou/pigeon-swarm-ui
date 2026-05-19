import {
  ClipboardEvent,
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  Session,
  StickerMessageReference,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { isBrowserPreviewImage } from '../../utils/browserPreview';
import { cx } from '../../utils/classNameHelper';
import {
  type EmojiSuggestion,
  findEmojiTrigger,
  replaceEmojiTrigger,
  searchEmojiSuggestions,
} from '../../utils/emojiShortcodes';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { StickerPicker } from './StickerPicker';
import { useDesktopInputFocus } from '../common/useDesktopInputFocus';

const MESSAGE_MAX_LENGTH = 4000;
const COMPOSER_MAX_ROWS = 4;
const LARGE_ATTACHMENT_BYTES = 50 * 1024 * 1024;

interface ComposerProps {
  disabled: boolean;
  error: string | null;
  draft: string;
  onSend: (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => Promise<void>;
  onStickerSend?: (sticker: StickerMessageReference) => Promise<void>;
  onDraftChange: (value: string) => void;
  onEscape?: () => void;
  focusKey?: string | null;
  placeholder?: string;
  progress?: AttachmentProgress | null;
  replyTo?: ChatMessage | null;
  replyToAuthorName?: string;
  session: Session;
  onCancelReply?: () => void;
}

export function Composer({
  disabled,
  draft,
  error,
  focusKey,
  onCancelReply,
  onDraftChange,
  onEscape,
  onSend,
  onStickerSend,
  placeholder = copy.composer.placeholder,
  progress,
  replyTo,
  replyToAuthorName,
  session,
}: ComposerProps) {
  const [attachments, setAttachments] = useState<
    { file: File; previewUrl: string }[]
  >([]);
  const [encryptLargeAttachments, setEncryptLargeAttachments] =
    useState(false);
  const [lightbox, setLightbox] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [caretIndex, setCaretIndex] = useState(0);
  const [dismissedEmojiTrigger, setDismissedEmojiTrigger] = useState<
    null | string
  >(null);
  const [emojiSuggestions, setEmojiSuggestions] = useState<EmojiSuggestion[]>(
    [],
  );
  const [selectedEmojiIndex, setSelectedEmojiIndex] = useState(0);
  const attachmentsRef = useRef(attachments);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const canAttach = !disabled;
  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) &&
    draft.trim().length <= MESSAGE_MAX_LENGTH &&
    !disabled;
  const emojiTrigger = useMemo(
    () => findEmojiTrigger(draft, caretIndex),
    [caretIndex, draft],
  );
  const emojiTriggerKey = emojiTrigger
    ? `${emojiTrigger.start}:${emojiTrigger.end}:${emojiTrigger.query}`
    : null;
  const emojiPanelOpen =
    emojiSuggestions.length > 0 && emojiTriggerKey !== dismissedEmojiTrigger;
  const canAutoFocusInput = useDesktopInputFocus();
  const hasLargeAttachments = attachments.some(
    (attachment) => attachment.file.size > LARGE_ATTACHMENT_BYTES,
  );

  useEffect(() => {
    setSelectedEmojiIndex(0);
  }, [emojiTriggerKey]);

  useEffect(() => {
    if (!emojiTrigger) {
      setEmojiSuggestions([]);

      return;
    }

    let cancelled = false;

    void searchEmojiSuggestions(emojiTrigger.query).then((suggestions) => {
      if (!cancelled) setEmojiSuggestions(suggestions);
    });

    return () => {
      cancelled = true;
    };
  }, [emojiTrigger]);

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
    if (!replyTo || disabled || !canAutoFocusInput) return;

    textInputRef.current?.focus();
  }, [canAutoFocusInput, disabled, replyTo]);

  useEffect(() => {
    if (!focusKey || disabled || !canAutoFocusInput) return;

    requestAnimationFrame(() => textInputRef.current?.focus());
  }, [canAutoFocusInput, disabled, focusKey]);

  const addFiles = useCallback((selectedFiles: File[]) => {
    setAttachmentError(null);
    setAttachments((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const syncCaret = () => {
    setCaretIndex(textInputRef.current?.selectionStart ?? draft.length);
  };

  const resizeTextInput = useCallback(() => {
    const input = textInputRef.current;

    if (!input) return;

    input.style.height = 'auto';

    const style = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const verticalPadding =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom);
    const maxHeight = lineHeight * COMPOSER_MAX_ROWS + verticalPadding;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);

    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  const insertEmoji = useCallback(
    (suggestion: EmojiSuggestion) => {
      if (!emojiTrigger) return;

      const next = replaceEmojiTrigger(draft, emojiTrigger, suggestion.emoji);

      if (next.value.length > MESSAGE_MAX_LENGTH) return;

      onDraftChange(next.value);
      setDismissedEmojiTrigger(null);
      setCaretIndex(next.nextCaretIndex);
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
        textInputRef.current?.setSelectionRange(
          next.nextCaretIndex,
          next.nextCaretIndex,
        );
      });
    },
    [draft, emojiTrigger, onDraftChange],
  );
  const insertLooseEmoji = useCallback(
    (emoji: string) => {
      const start = textInputRef.current?.selectionStart ?? caretIndex;
      const end = textInputRef.current?.selectionEnd ?? caretIndex;
      const nextValue = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
      const nextCaretIndex = start + emoji.length;

      if (nextValue.length > MESSAGE_MAX_LENGTH) return;

      onDraftChange(nextValue);
      setCaretIndex(nextCaretIndex);
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
        textInputRef.current?.setSelectionRange(
          nextCaretIndex,
          nextCaretIndex,
        );
      });
    },
    [caretIndex, draft, onDraftChange],
  );

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

  useEffect(() => {
    resizeTextInput();
  }, [draft, resizeTextInput]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();

    if (!canSend) return;

    void onSend(
      trimmed,
      attachments.map((attachment) => attachment.file),
      { encryptLargeAttachments },
    );
    onDraftChange('');
    attachments.forEach((attachment) =>
      URL.revokeObjectURL(attachment.previewUrl),
    );
    setAttachments([]);
    setAttachmentError(null);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (canAutoFocusInput) {
      window.setTimeout(() => textInputRef.current?.focus(), 0);
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onDraftChange(event.target.value);
    setCaretIndex(event.target.selectionStart ?? event.target.value.length);
    setDismissedEmojiTrigger(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.shiftKey) return;

    if (emojiPanelOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedEmojiTrigger(emojiTriggerKey);

        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedEmojiIndex((current) =>
          Math.min(current + 1, emojiSuggestions.length - 1),
        );

        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedEmojiIndex((current) => Math.max(current - 1, 0));

        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertEmoji(
          emojiSuggestions[selectedEmojiIndex] ?? emojiSuggestions[0],
        );

        return;
      }
    }

    if (event.key === 'Escape') {
      onEscape?.();

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canAttach) return;

    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item, index) => clipboardFile(item.getAsFile(), item.type, index))
      .filter((file): file is File => !!file);

    if (imageFiles.length === 0) return;

    event.preventDefault();
    addFiles(imageFiles);
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
        ref={formRef}
        onSubmit={handleSubmit}
        className="shrink-0 touch-pan-x border-t border-white/10 p-4 sm:p-5"
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
              className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/80 transition hover:bg-white/15"
              aria-label={copy.messages.cancelReply}
            >
              ×
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {imageAttachments.length > 0 && (
                <ComposerImageAlbum
                  attachments={imageAttachments}
                  disabled={disabled}
                  lightboxImages={lightboxImages}
                  onOpen={(index) =>
                    setLightbox({ images: lightboxImages, index })
                  }
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
            <AttachmentEncryptionControl
              disabled={disabled || !hasLargeAttachments}
              enabled={!hasLargeAttachments || encryptLargeAttachments}
              largeAttachments={hasLargeAttachments}
              onChange={setEncryptLargeAttachments}
            />
          </>
        )}
        {progress && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-white/70">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">
                {progress.phase === 'encrypt'
                  ? copy.composer.encryptingAttachment
                  : progress.phase === 'upload'
                    ? copy.composer.uploadingAttachment
                    : progress.phase === 'download'
                      ? copy.composer.downloadingAttachment
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
            'relative flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 transition',
            disabled && 'cursor-not-allowed opacity-45',
          )}
        >
          {emojiPanelOpen && emojiTrigger && (
            <EmojiSuggestionPanel
              onSelect={insertEmoji}
              query={emojiTrigger.query}
              selectedIndex={selectedEmojiIndex}
              setSelectedIndex={setSelectedEmojiIndex}
              suggestions={emojiSuggestions}
            />
          )}
          {onStickerSend && (
            <StickerPicker
              disabled={disabled}
              onEmojiInsert={insertLooseEmoji}
              onStickerSend={onStickerSend}
              session={session}
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
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
          <textarea
            ref={textInputRef}
            value={draft}
            onChange={handleContentChange}
            onClick={syncCaret}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCaret}
            onPaste={handlePaste}
            onSelect={syncCaret}
            disabled={disabled}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={1}
            className="min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed"
            placeholder={placeholder}
          />
          <span className="hidden min-w-12 text-right text-xs font-black text-white/35 sm:block">
            {draft.length}/{MESSAGE_MAX_LENGTH}
          </span>
          <button
            disabled={!canSend}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copy.composer.send}
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
            <div className="grid h-full w-full place-items-center rounded-2xl border-2 border-dashed border-fuchsia-300/70 bg-fuchsia-500/10 text-center shadow-2xl shadow-black/40">
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

function AttachmentEncryptionControl({
  disabled,
  enabled,
  largeAttachments,
  onChange,
}: {
  disabled: boolean;
  enabled: boolean;
  largeAttachments: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const effectiveEnabled = !largeAttachments || enabled;

  return (
    <div className="mb-3">
      <label
        className={cx(
          'flex min-h-10 max-w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-xs font-black transition',
          effectiveEnabled
            ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-50'
            : 'border-cyan-300/35 bg-cyan-400/15 text-cyan-50',
          disabled && 'cursor-not-allowed opacity-70',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate">
            {copy.composer.encryptAttachments}
          </span>
          {largeAttachments && (
            <span className="block truncate text-[0.65rem] text-white/45">
              {effectiveEnabled
                ? copy.composer.largeAttachmentsEncrypted
                : copy.composer.publicLargeAttachments}
            </span>
          )}
        </span>
        <span
          className={cx(
            'relative h-6 w-11 shrink-0 rounded-full border transition',
            effectiveEnabled
              ? 'border-emerald-200/60 bg-emerald-300'
              : 'border-white/15 bg-white/10',
          )}
        >
          <input
            type="checkbox"
            checked={effectiveEnabled}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cx(
              'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition',
              effectiveEnabled ? 'left-6' : 'left-1',
            )}
          />
        </span>
      </label>
    </div>
  );
}

function AttachmentPreview({ file, url }: { file: File; url: string }) {
  if (isBrowserPreviewImage(file.type)) {
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

function EmojiSuggestionPanel({
  onSelect,
  query,
  selectedIndex,
  setSelectedIndex,
  suggestions,
}: {
  onSelect: (suggestion: EmojiSuggestion) => void;
  query: string;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  suggestions: EmojiSuggestion[];
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-[min(28rem,calc(100vh-12rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#24242b] shadow-2xl shadow-black/40">
      <div className="border-b border-white/5 px-4 py-3 text-xs font-black uppercase tracking-wide text-white/45">
        {copy.composer.emojiMatches} :{query.toUpperCase()}
      </div>
      <div className="max-h-[min(24rem,calc(100vh-16rem))] overflow-y-auto p-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.shortcode}
            type="button"
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(suggestion);
            }}
            className={cx(
              'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition',
              index === selectedIndex ? 'bg-white/12' : 'hover:bg-white/8',
            )}
            aria-label={`${copy.composer.insertEmoji} :${suggestion.shortcode}:`}
            title={`:${suggestion.shortcode}:`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center text-xl leading-none">
              {suggestion.emoji}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-white/80">
              :{suggestion.shortcode}:
            </span>
          </button>
        ))}
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

function clipboardFile(
  file: File | null,
  contentType: string,
  index: number,
): File | null {
  if (!file) return null;

  if (file.name) return file;

  return new File(
    [file],
    `clipboard-image-${index + 1}.${imageExtension(contentType)}`,
    {
      type: contentType,
    },
  );
}

function imageExtension(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';

  if (contentType === 'image/gif') return 'gif';

  if (contentType === 'image/webp') return 'webp';

  return 'png';
}
