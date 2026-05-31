import type { CSSProperties, ReactNode } from 'react';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import {
  type EmojiSuggestion,
  searchEmojiSuggestions,
} from '../../../../modules/messages/presentation/emoji/emojiShortcodes';
import {
  loadRecentReactionEmojis,
  saveRecentReactionEmoji,
} from '../../../../modules/messages/presentation/emoji/recentReactionEmojis';
import {
  CopyIcon,
  DataIcon,
  EditIcon,
  PinIcon,
  ReplyIcon,
  ThreadIcon,
  TrashIcon,
} from '../../../../modules/messages/presentation/components/messageActionIcons';
import { useDesktopInputFocus } from '../../../../shared/presentation/components/useDesktopInputFocus';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';

export type MessageContextMenuState = {
  message: ChatMessage;
  source?: 'thread' | 'timeline';
  x: number;
  y: number;
};

export function MessageContextMenu({
  currentIdentityId,
  menu,
  onClose,
  onCopy,
  onDelete,
  onEdit,
  onOpenThread,
  onPin,
  onReply,
  onReactionToggle,
  onUnpin,
  onViewRaw,
  pinned = false,
}: {
  currentIdentityId?: string;
  menu: MessageContextMenuState;
  onClose: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onOpenThread?: () => void;
  onPin?: () => void;
  onReply?: () => void;
  onUnpin?: () => void;
  onReactionToggle?: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onViewRaw: () => void;
  pinned?: boolean;
}) {
  useCloseOnEscape(onClose);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const emojiSearchRef = useRef<HTMLDivElement | null>(null);
  const [emojiSearchOpen, setEmojiSearchOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojiSuggestions, setEmojiSuggestions] = useState<EmojiSuggestion[]>(
    [],
  );
  const [emojiListMaxHeight, setEmojiListMaxHeight] = useState(256);
  const [position, setPosition] = useState(() => ({
    left: menu.x,
    top: menu.y,
  }));
  const canAutoFocusInput = useDesktopInputFocus();
  const [recentEmojis, setRecentEmojis] = useState(() =>
    loadRecentReactionEmojis(currentIdentityId),
  );
  const quickReactions = useMemo(
    () => quickReactionOptions(menu.message, recentEmojis),
    [menu.message, recentEmojis],
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
  const runAction = (action: () => void) => {
    onClose();
    action();
  };
  const anchorStyle = {
    anchorName: '--message-menu-anchor',
    left: menu.x,
    top: menu.y,
  } as CSSProperties & { anchorName: string };
  const menuStyle = {
    '--message-menu-left': `${position.left}px`,
    '--message-menu-top': `${position.top}px`,
    positionAnchor: '--message-menu-anchor',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
  } as CSSProperties & {
    '--message-menu-left': string;
    '--message-menu-top': string;
    positionAnchor: string;
  };

  useEffect(() => {
    const element = menuRef.current;

    if (!element) return;

    const gap = 8;
    const rect = element.getBoundingClientRect();
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const preferredTop = coarsePointer ? menu.y - rect.height / 2 : menu.y;
    const nextLeft = Math.min(
      Math.max(gap, menu.x),
      Math.max(gap, window.innerWidth - rect.width - gap),
    );
    const nextTop = Math.min(
      Math.max(gap, preferredTop),
      Math.max(gap, window.innerHeight - rect.height - gap),
    );

    setPosition({ left: nextLeft, top: nextTop });

    const emojiSearch = emojiSearchRef.current;

    if (!emojiSearch) return;

    const availableBelow =
      window.innerHeight - (nextTop + emojiSearch.offsetTop) - gap;
    const reservedMenuActionsHeight = 96;

    setEmojiListMaxHeight(
      Math.max(96, Math.min(256, availableBelow - reservedMenuActionsHeight)),
    );
  }, [emojiSearchOpen, menu.x, menu.y]);

  useLayoutEffect(() => {
    if (!emojiSearchOpen) {
      setEmojiSuggestions([]);

      return;
    }

    let cancelled = false;

    void searchEmojiSuggestions(emojiQuery, 24).then((suggestions) => {
      if (!cancelled) setEmojiSuggestions(suggestions);
    });

    return () => {
      cancelled = true;
    };
  }, [emojiQuery, emojiSearchOpen]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] cursor-default select-none"
        onClick={onClose}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        aria-label={copy.dialog.close}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none fixed h-px w-px"
        style={anchorStyle}
      />
      <div
        ref={menuRef}
        className="message-context-menu fixed z-[90] max-h-[calc(100dvh-1rem)] min-w-56 max-w-[calc(100vw-1rem)] select-none overflow-y-auto rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40"
        style={menuStyle}
        onContextMenu={(event) => event.preventDefault()}
      >
        {onReactionToggle &&
        currentIdentityId &&
        menu.message.kind !== 'poll' ? (
          <div className="border-b border-white/10 p-1">
            <div className="flex items-center gap-1">
              {quickReactions.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={cx(
                    'grid h-8 w-8 place-items-center rounded-2xl text-base transition hover:bg-white/10 active:bg-white/20 active:brightness-125',
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
                className="grid h-8 w-8 place-items-center rounded-2xl bg-white/8 text-sm font-black text-white/75 transition hover:bg-white/12 active:bg-white/20 active:text-white"
                aria-label={copy.messages.searchReaction}
              >
                +
              </button>
            </div>
            {emojiSearchOpen && (
              <div
                ref={emojiSearchRef}
                className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-2"
              >
                <input
                  autoFocus={canAutoFocusInput}
                  value={emojiQuery}
                  onChange={(event) => setEmojiQuery(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder={copy.messages.searchReaction}
                />
                <div
                  className="mt-2 overflow-y-auto"
                  style={{ maxHeight: emojiListMaxHeight }}
                >
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
        {onOpenThread ? (
          <MessageMenuAction
            icon={<ThreadIcon />}
            label={copy.messages.openThread}
            onClick={() => runAction(onOpenThread)}
          />
        ) : null}
        {onReply ? (
          <MessageMenuAction
            icon={<ReplyIcon />}
            label={copy.messages.reply}
            onClick={() => runAction(onReply)}
          />
        ) : null}
        {onCopy ? (
          <MessageMenuAction
            icon={<CopyIcon />}
            label={copy.messages.copy}
            onClick={() => runAction(onCopy)}
          />
        ) : null}
        {onEdit ? (
          <MessageMenuAction
            icon={<EditIcon />}
            label={copy.messages.edit}
            onClick={() => runAction(onEdit)}
          />
        ) : null}
        {onUnpin ? (
          <MessageMenuAction
            icon={<PinIcon />}
            label={copy.messages.unpin}
            onClick={() => runAction(onUnpin)}
          />
        ) : onPin ? (
          <MessageMenuAction
            icon={<PinIcon />}
            label={pinned ? copy.messages.unpin : copy.messages.pin}
            onClick={() => runAction(onPin)}
          />
        ) : null}
        <MessageMenuAction
          icon={<DataIcon />}
          label={copy.messages.viewRaw}
          onClick={() => runAction(onViewRaw)}
        />
        {onDelete ? (
          <MessageMenuAction
            icon={<TrashIcon />}
            label={copy.messages.delete}
            onClick={() => runAction(onDelete)}
            tone="danger"
          />
        ) : null}
      </div>
    </>
  );
}

const defaultReactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function MessageMenuAction({
  icon,
  label,
  onClick,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'neutral';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left font-black transition active:bg-white/20 active:text-white',
        tone === 'danger'
          ? 'text-rose-200 hover:bg-rose-500/15 active:bg-rose-400/25'
          : 'text-white/80 hover:bg-white/10',
      )}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center text-white/55">
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

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
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-white/8 active:bg-white/20"
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
