import type { ReactElement } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import type { EmojiSuggestion } from '../emoji/emojiShortcodes';

export function SendArrowIcon({
  className,
}: {
  className?: string;
}): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.75"
      viewBox="0 0 24 24"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function StickerPickerFallbackButton({
  disabled,
}: {
  disabled: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-xl text-white/45 transition disabled:cursor-not-allowed disabled:opacity-45"
      aria-label={copy.stickers.openPicker}
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <path d="M9 9h.01" />
        <path d="M15 9h.01" />
      </svg>
    </button>
  );
}

export function AttachmentEncryptionControl({
  disabled,
  enabled,
  encryptedDescription,
  onChange,
  publicDescription,
  title,
}: {
  disabled: boolean;
  enabled: boolean;
  encryptedDescription: string;
  onChange: (enabled: boolean) => void;
  publicDescription: string;
  title: string;
}): ReactElement {
  return (
    <div className="mb-3">
      <label
        className={cx(
          'flex min-h-10 max-w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-xs font-black transition',
          enabled
            ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-50'
            : 'border-cyan-300/35 bg-cyan-400/15 text-cyan-50',
          disabled && 'cursor-not-allowed opacity-70',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate">{title}</span>
          <span className="block truncate text-[0.65rem] text-white/45">
            {enabled ? encryptedDescription : publicDescription}
          </span>
        </span>
        <span
          className={cx(
            'relative h-6 w-11 shrink-0 rounded-full border transition',
            enabled
              ? 'border-emerald-200/60 bg-emerald-300'
              : 'border-white/15 bg-white/10',
          )}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cx(
              'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition',
              enabled ? 'left-6' : 'left-1',
            )}
          />
        </span>
      </label>
    </div>
  );
}

export function EmojiSuggestionPanel({
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
}): ReactElement {
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
