import type { ReactNode } from 'react';

import type {
  ChatMessage,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';

export type MessageCollectionAction = {
  label: string;
  onClick: (message: ChatMessage) => void;
  tone?: 'danger' | 'neutral';
};

export function MessageCollectionDialog({
  actions = [],
  emptyLabel,
  identityNames,
  identityPictures = {},
  messages,
  onClose,
  onMessageOpen,
  subtitle,
  title,
}: {
  actions?: MessageCollectionAction[];
  emptyLabel: string;
  identityNames: Record<string, string>;
  identityPictures?: Record<string, string | undefined>;
  messages: ChatMessage[];
  onClose: () => void;
  onMessageOpen?: (message: ChatMessage) => void;
  subtitle?: ReactNode;
  title: string;
}) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-black/60"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="fixed left-1/2 top-1/2 z-[90] flex max-h-[min(720px,calc(100dvh-2rem))] w-[min(560px,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172d] shadow-2xl shadow-black/45">
        <header className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-white">
                {title}
              </h2>
              {subtitle ? (
                <div className="mt-1 text-sm text-white/50">{subtitle}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/8 text-lg font-black text-white/70 transition hover:bg-white/12 hover:text-white"
              aria-label={copy.dialog.close}
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm font-semibold text-white/50">
              {emptyLabel}
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <MessageCollectionItem
                  actions={actions}
                  identityNames={identityNames}
                  identityPictures={identityPictures}
                  key={message.id}
                  message={message}
                  onMessageOpen={onMessageOpen}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function MessageCollectionItem({
  actions,
  identityNames,
  identityPictures,
  message,
  onMessageOpen,
}: {
  actions: MessageCollectionAction[];
  identityNames: Record<string, string>;
  identityPictures: Record<string, string | undefined>;
  message: ChatMessage;
  onMessageOpen?: (message: ChatMessage) => void;
}) {
  const content = messageSummary(message);
  const authorName = identityDisplayName(message.authorIdentityId, identityNames);
  const authorPicture = identityPictures[message.authorIdentityId];

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <button
        type="button"
        disabled={!onMessageOpen}
        onClick={() => onMessageOpen?.(message)}
        className="flex w-full min-w-0 gap-3 text-left disabled:cursor-default"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xs font-black text-slate-950">
          {authorPicture ? (
            <img
              alt=""
              src={authorPicture}
              className="h-full w-full object-cover"
            />
          ) : (
            authorName.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3 text-xs text-white/45">
            <span className="min-w-0 truncate font-black text-white/70">
              {authorName}
            </span>
            <span className="shrink-0">
              {new Date(message.timestamp).toLocaleString()}
            </span>
          </span>
          <span className="mt-2 block line-clamp-4 whitespace-pre-wrap break-words text-sm font-semibold leading-5 text-white/80">
            {content}
          </span>
        </span>
      </button>
      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              onClick={() => action.onClick(message)}
              className={
                action.tone === 'danger'
                  ? 'rounded-2xl bg-rose-500/15 px-3 py-1.5 text-xs font-black text-rose-100 transition hover:bg-rose-500/25'
                  : 'rounded-2xl bg-white/8 px-3 py-1.5 text-xs font-black text-white/70 transition hover:bg-white/12 hover:text-white'
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function messageSummary(message: ChatMessage): string {
  if (message.kind === 'poll') {
    return message.poll?.question ?? copy.polls.poll;
  }

  if (message.sticker) {
    return copy.stickers.stickerAlt;
  }

  if (message.content.trim()) {
    return message.content;
  }

  if (message.attachments.length > 0) {
    return attachmentSummary(message.attachments);
  }

  return copy.messages.originalMessage;
}

function attachmentSummary(attachments: MessageAttachment[]): string {
  const [first] = attachments;

  if (!first) return copy.messages.originalMessage;

  return attachments.length === 1
    ? first.filename
    : `${first.filename} +${attachments.length - 1}`;
}
