import type { CSSProperties, ReactNode, RefObject } from 'react';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { MessageAttachment } from '../../../../contexts/attachments/application/contracts/MessageAttachment';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';

import {
  CopyIcon,
  DataIcon,
  DownloadIcon,
  EditIcon,
  PinIcon,
  ReplyIcon,
  ThreadIcon,
  TrashIcon,
} from '../../../../contexts/messages/presentation/components/messageActionIcons';
import {
  formatFileSize,
  isAudioAttachment,
  isImageAttachment,
  isPublicUnencryptedAttachment,
  isVideoAttachment,
} from '../../../../contexts/messages/presentation/components/messageAttachments';
import {
  type EmojiSuggestion,
  searchEmojiSuggestions,
} from '../../../../contexts/messages/presentation/emoji/emojiShortcodes';
import {
  loadRecentReactionEmojis,
  saveRecentReactionEmoji,
} from '../../../../contexts/messages/presentation/emoji/recentReactionEmojis';
import { useDesktopInputFocus } from '../../../../shared/presentation/components/useDesktopInputFocus';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { ipfsUrl } from '../../../../shared/presentation/ipfsLinks';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';

export type MessageContextMenuState = {
  message: ChatMessage;
  source?: 'thread' | 'timeline';
  x: number;
  y: number;
};

const menuEdgeGap = 8;

const defaultReactionOptions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function messageReactions(
  message: ChatMessage,
): NonNullable<ChatMessage['reactions']> {
  return message.reactions ?? [];
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

function downloadAttachmentLabel(attachment: MessageAttachment): string {
  const template = isAudioAttachment(attachment)
    ? copy.attachments.downloadAudioWithSize
    : isImageAttachment(attachment)
      ? copy.attachments.downloadImageWithSize
      : copy.attachments.downloadVideoWithSize;

  return template.replace('{size}', formatFileSize(attachment.size));
}

function isDownloadableAttachment(attachment: MessageAttachment): boolean {
  return (
    isAudioAttachment(attachment) ||
    isImageAttachment(attachment) ||
    isVideoAttachment(attachment)
  );
}

function isShareableIpfsAttachment(
  attachment: MessageAttachment,
): attachment is MessageAttachment & { cid: string } {
  return (
    typeof attachment.cid === 'string' &&
    isDownloadableAttachment(attachment) &&
    isPublicUnencryptedAttachment(attachment)
  );
}

function menuPositionFor(
  element: HTMLElement,
  x: number,
  y: number,
): { left: number; top: number } {
  const rect = element.getBoundingClientRect();
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const preferredTop = coarsePointer ? y - rect.height / 2 : y;

  return {
    left: Math.min(
      Math.max(menuEdgeGap, x),
      Math.max(menuEdgeGap, window.innerWidth - rect.width - menuEdgeGap),
    ),
    top: Math.min(
      Math.max(menuEdgeGap, preferredTop),
      Math.max(menuEdgeGap, window.innerHeight - rect.height - menuEdgeGap),
    ),
  };
}

function emojiListMaxHeightFor(emojiSearch: HTMLElement, top: number): number {
  const availableBelow =
    window.innerHeight - (top + emojiSearch.offsetTop) - menuEdgeGap;
  const reservedMenuActionsHeight = 96;

  return Math.max(
    96,
    Math.min(256, availableBelow - reservedMenuActionsHeight),
  );
}

function highlightMessageForMenu(messageId: string): (() => void) | undefined {
  const messageElement = document.querySelector<HTMLElement>(
    `[data-message-id="${CSS.escape(messageId)}"] [data-message-bubble]`,
  );

  if (!messageElement) return undefined;

  messageElement.classList.add('message-context-ring');

  return () => {
    messageElement.classList.remove('message-context-ring');
  };
}

function syncEmojiSuggestions(
  open: boolean,
  query: string,
  setSuggestions: (suggestions: EmojiSuggestion[]) => void,
): (() => void) | undefined {
  if (!open) {
    setSuggestions([]);

    return undefined;
  }

  let cancelled = false;

  void searchEmojiSuggestions(query, 24).then((suggestions) => {
    if (!cancelled) setSuggestions(suggestions);
  });

  return () => {
    cancelled = true;
  };
}

async function shareAttachmentLink(
  attachment: MessageAttachment & { cid: string },
): Promise<void> {
  const url = ipfsUrl(attachment.cid);

  if (navigator.clipboard) await navigator.clipboard.writeText(url);
}

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

function MessageQuickReactions({
  currentIdentityId,
  message,
  onToggleEmojiSearch,
  onToggleReaction,
  quickReactions,
}: {
  currentIdentityId: string;
  message: ChatMessage;
  onToggleEmojiSearch: () => void;
  onToggleReaction: (emoji: string) => void;
  quickReactions: string[];
}) {
  return (
    <div className="flex items-center gap-1">
      {quickReactions.map((emoji) => (
        <button
          type="button"
          key={emoji}
          onClick={() => onToggleReaction(emoji)}
          className={cx(
            'grid h-8 w-8 place-items-center rounded-2xl text-base transition hover:bg-white/10 active:bg-white/20 active:brightness-125',
            hasReacted(message, currentIdentityId, emoji) && 'bg-sky-500/35',
          )}
          aria-label={`${copy.messages.addReaction} ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      <button
        type="button"
        onClick={onToggleEmojiSearch}
        className="grid h-8 w-8 place-items-center rounded-2xl bg-white/8 text-sm font-black text-white/75 transition hover:bg-white/12 active:bg-white/20 active:text-white"
        aria-label={copy.messages.searchReaction}
      >
        +
      </button>
    </div>
  );
}

function MessageEmojiSearchPanel({
  canAutoFocusInput,
  emojiListMaxHeight,
  emojiQuery,
  emojiSearchRef,
  emojiSuggestions,
  onEmojiQueryChange,
  onToggleReaction,
}: {
  canAutoFocusInput: boolean;
  emojiListMaxHeight: number;
  emojiQuery: string;
  emojiSearchRef: RefObject<HTMLDivElement | null>;
  emojiSuggestions: EmojiSuggestion[];
  onEmojiQueryChange: (query: string) => void;
  onToggleReaction: (emoji: string) => void;
}) {
  return (
    <div
      ref={emojiSearchRef}
      className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-2"
    >
      <input
        autoFocus={canAutoFocusInput}
        value={emojiQuery}
        onChange={(event) => onEmojiQueryChange(event.target.value)}
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
            onSelect={onToggleReaction}
            suggestion={suggestion}
          />
        ))}
      </div>
    </div>
  );
}

function MessageMenuContentActions({
  downloadableAttachment,
  onCopy,
  onDownloadAttachment,
  onReply,
  runAction,
  shareableAttachment,
}: {
  downloadableAttachment: MessageAttachment | undefined;
  onCopy?: () => void;
  onDownloadAttachment?: (attachment: MessageAttachment) => void;
  onReply?: () => void;
  runAction: (action: () => Promise<void> | void) => void;
  shareableAttachment: (MessageAttachment & { cid: string }) | undefined;
}) {
  return (
    <>
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
      {downloadableAttachment && onDownloadAttachment ? (
        <MessageMenuAction
          icon={<DownloadIcon />}
          label={downloadAttachmentLabel(downloadableAttachment)}
          onClick={() =>
            runAction(() => onDownloadAttachment(downloadableAttachment))
          }
        />
      ) : null}
      {shareableAttachment ? (
        <MessageMenuAction
          icon={<CopyIcon />}
          label={copy.attachments.shareIpfs}
          onClick={() =>
            runAction(() => shareAttachmentLink(shareableAttachment))
          }
        />
      ) : null}
    </>
  );
}

function MessageMenuThreadPinActions({
  onEdit,
  onOpenThread,
  onPin,
  onUnpin,
  pinned,
  runAction,
}: {
  onEdit?: () => void;
  onOpenThread?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  pinned: boolean;
  runAction: (action: () => Promise<void> | void) => void;
}) {
  return (
    <>
      {onEdit ? (
        <MessageMenuAction
          icon={<EditIcon />}
          label={copy.messages.edit}
          onClick={() => runAction(onEdit)}
        />
      ) : null}
      {onOpenThread ? (
        <MessageMenuAction
          icon={<ThreadIcon />}
          label={copy.messages.openThread}
          onClick={() => runAction(onOpenThread)}
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
    </>
  );
}

function MessageMenuTrailingActions({
  onDelete,
  onViewRaw,
  runAction,
  technicalDetailsVisible,
}: {
  onDelete?: () => void;
  onViewRaw: () => void;
  runAction: (action: () => Promise<void> | void) => void;
  technicalDetailsVisible: boolean;
}) {
  return (
    <>
      {technicalDetailsVisible ? (
        <MessageMenuAction
          icon={<DataIcon />}
          label={copy.messages.viewRaw}
          onClick={() => runAction(onViewRaw)}
        />
      ) : null}
      {onDelete ? (
        <>
          <div className="my-1 h-px bg-white/10" />
          <MessageMenuAction
            icon={<TrashIcon />}
            label={copy.messages.deleteForEveryone}
            onClick={() => runAction(onDelete)}
            tone="danger"
          />
        </>
      ) : null}
    </>
  );
}

export function MessageContextMenu({
  currentIdentityId,
  menu,
  onClose,
  onCopy,
  onDelete,
  onDownloadAttachment,
  onEdit,
  onOpenThread,
  onPin,
  onReactionToggle,
  onReply,
  onUnpin,
  onViewRaw,
  pinned = false,
}: {
  currentIdentityId?: string;
  menu: MessageContextMenuState;
  onClose: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onDownloadAttachment?: (attachment: MessageAttachment) => void;
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
  const { close, state } = useCloseTransition(onClose);
  const [technicalDetailsVisible] = useTechnicalDetailsPreference();

  useCloseOnEscape(close);

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
  const downloadableAttachment = useMemo(
    () => menu.message.attachments.find(isDownloadableAttachment),
    [menu.message.attachments],
  );
  const shareableAttachment = useMemo(
    () => menu.message.attachments.find(isShareableIpfsAttachment),
    [menu.message.attachments],
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
    close();
  };
  const toggleEmojiSearch = () => setEmojiSearchOpen((isOpen) => !isOpen);
  const runAction = (action: () => Promise<void> | void) => {
    close();
    void action();
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

    const nextPosition = menuPositionFor(element, menu.x, menu.y);

    setPosition(nextPosition);

    const emojiSearch = emojiSearchRef.current;

    if (!emojiSearch) return;

    setEmojiListMaxHeight(emojiListMaxHeightFor(emojiSearch, nextPosition.top));
  }, [emojiSearchOpen, menu.x, menu.y]);

  useEffect(() => highlightMessageForMenu(menu.message.id), [menu.message.id]);

  useLayoutEffect(
    () =>
      syncEmojiSuggestions(emojiSearchOpen, emojiQuery, setEmojiSuggestions),
    [emojiQuery, emojiSearchOpen],
  );

  return (
    <>
      <button
        type="button"
        className="app-overlay-scrim fixed inset-0 z-[80] cursor-default select-none"
        data-state={state}
        onClick={close}
        onContextMenu={(event) => {
          event.preventDefault();
          close();
        }}
        style={{
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
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
        className="message-context-menu app-context-menu fixed z-[90] max-h-[calc(100dvh-1rem)] min-w-56 max-w-[calc(100vw-1rem)] select-none overflow-y-auto rounded-2xl border border-white/10 bg-[#15172d] p-1 text-sm shadow-2xl shadow-black/40"
        data-state={state}
        style={menuStyle}
        onContextMenu={(event) => event.preventDefault()}
      >
        {onReactionToggle &&
        currentIdentityId &&
        menu.message.kind !== 'poll' ? (
          <div className="border-b border-white/10 p-1">
            <MessageQuickReactions
              currentIdentityId={currentIdentityId}
              message={menu.message}
              onToggleEmojiSearch={toggleEmojiSearch}
              onToggleReaction={toggleReaction}
              quickReactions={quickReactions}
            />
            {emojiSearchOpen && (
              <MessageEmojiSearchPanel
                canAutoFocusInput={canAutoFocusInput}
                emojiListMaxHeight={emojiListMaxHeight}
                emojiQuery={emojiQuery}
                emojiSearchRef={emojiSearchRef}
                emojiSuggestions={emojiSuggestions}
                onEmojiQueryChange={setEmojiQuery}
                onToggleReaction={toggleReaction}
              />
            )}
          </div>
        ) : null}
        <MessageMenuContentActions
          downloadableAttachment={downloadableAttachment}
          onCopy={onCopy}
          onDownloadAttachment={onDownloadAttachment}
          onReply={onReply}
          runAction={runAction}
          shareableAttachment={shareableAttachment}
        />
        <MessageMenuThreadPinActions
          onEdit={onEdit}
          onOpenThread={onOpenThread}
          onPin={onPin}
          onUnpin={onUnpin}
          pinned={pinned}
          runAction={runAction}
        />
        <MessageMenuTrailingActions
          onDelete={onDelete}
          onViewRaw={onViewRaw}
          runAction={runAction}
          technicalDetailsVisible={technicalDetailsVisible}
        />
      </div>
    </>
  );
}
