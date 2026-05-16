import { useMemo, useState } from 'react';

import type { ChatMessage } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import {
  type EmojiSuggestion,
  searchEmojiSuggestions,
} from '../../utils/emojiShortcodes';
import {
  loadRecentReactionEmojis,
  saveRecentReactionEmoji,
} from '../../utils/recentReactionEmojis';

export type MessageContextMenuState = {
  message: ChatMessage;
  x: number;
  y: number;
};

export function MessageContextMenu({
  currentIdentityId,
  menu,
  onClose,
  onDelete,
  onReactionToggle,
  onReply,
  onViewRaw,
}: {
  currentIdentityId?: string;
  menu: MessageContextMenuState;
  onClose: () => void;
  onDelete?: () => void;
  onReactionToggle?: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReply?: () => void;
  onViewRaw: () => void;
}) {
  const [emojiSearchOpen, setEmojiSearchOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState(() =>
    loadRecentReactionEmojis(currentIdentityId),
  );
  const quickReactions = useMemo(
    () => quickReactionOptions(menu.message, recentEmojis),
    [menu.message, recentEmojis],
  );
  const emojiSuggestions = useMemo(
    () => searchEmojiSuggestions(emojiQuery, 24),
    [emojiQuery],
  );
  const toggleReaction = (emoji: string) => {
    const reacted = Boolean(
      currentIdentityId &&
        messageReactions(menu.message).some(
          (reaction) =>
            reaction.authorIdentityId === currentIdentityId &&
            reaction.emoji === emoji,
        ),
    );

    setRecentEmojis(saveRecentReactionEmoji(currentIdentityId, emoji));
    onReactionToggle?.(menu.message, emoji, reacted);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] cursor-default"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <div
        className="fixed z-[90] min-w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40"
        style={{ left: menu.x, top: menu.y }}
      >
        {onReactionToggle && currentIdentityId ? (
          <div className="border-b border-white/10 p-1">
            <div className="flex items-center gap-1">
              {quickReactions.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={cx(
                    'grid h-8 w-8 place-items-center rounded-xl text-base transition hover:bg-white/10',
                    hasReacted(menu.message, currentIdentityId, emoji) &&
                      'bg-sky-500/35',
                  )}
                  aria-label={`${copy.messages.addReaction} ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEmojiSearchOpen((isOpen) => !isOpen)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-sm font-black text-white/75 transition hover:bg-white/12"
                aria-label={copy.messages.searchReaction}
              >
                +
              </button>
            </div>
            {emojiSearchOpen && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-2">
                <input
                  autoFocus
                  value={emojiQuery}
                  onChange={(event) => setEmojiQuery(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder={copy.messages.searchReaction}
                />
                <div className="mt-2 max-h-64 overflow-y-auto">
                  {emojiSuggestions.map((suggestion) => (
                    <EmojiSearchOption
                      key={suggestion.shortcode}
                      onSelect={toggleReaction}
                      suggestion={suggestion}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        {onReply ? (
          <button
            type="button"
            onClick={onReply}
            className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
          >
            {copy.messages.reply}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onViewRaw}
          className="block w-full rounded-xl px-3 py-2 text-left font-black text-white/80 transition hover:bg-white/10"
        >
          {copy.messages.viewRaw}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="block w-full rounded-xl px-3 py-2 text-left font-black text-rose-200 transition hover:bg-rose-500/15"
          >
            {copy.messages.delete}
          </button>
        ) : null}
      </div>
    </>
  );
}

const defaultReactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function EmojiSearchOption({
  onSelect,
  suggestion,
}: {
  onSelect: (emoji: string) => void;
  suggestion: EmojiSuggestion;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion.emoji)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/8"
      title={`:${suggestion.shortcode}:`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center text-xl leading-none">
        {suggestion.emoji}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-white/80">
        :{suggestion.shortcode}:
      </span>
    </button>
  );
}

function hasReacted(
  message: ChatMessage,
  currentIdentityId: string,
  emoji: string,
): boolean {
  return messageReactions(message).some(
    (reaction) =>
      reaction.authorIdentityId === currentIdentityId &&
      reaction.emoji === emoji,
  );
}

function quickReactionOptions(
  message: ChatMessage,
  recentEmojis: string[],
): string[] {
  const byEmoji = new Map<string, number>();

  for (const reaction of messageReactions(message)) {
    byEmoji.set(reaction.emoji, (byEmoji.get(reaction.emoji) ?? 0) + 1);
  }

  const existing = [...byEmoji.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([emoji]) => emoji);
  const merged = [...recentEmojis, ...existing, ...defaultReactionOptions];

  return [...new Set(merged)].slice(0, 6);
}

function messageReactions(
  message: ChatMessage,
): NonNullable<ChatMessage['reactions']> {
  return message.reactions ?? [];
}
