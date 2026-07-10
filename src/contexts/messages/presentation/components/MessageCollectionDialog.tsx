import type { ReactNode } from 'react';

import type {
  ChatMessage,
  MessageAttachment,
} from '../../../../shared/domain/pigeonResources.types';

import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../identities/presentation/view-models/identityDisplay';

export type MessageCollectionAction = {
  label: string;
  onClick: (message: ChatMessage) => void;
  tone?: 'danger' | 'neutral';
};

export function MessageCollectionDialog({
  actions = [],
  description,
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
  description?: string;
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
        className="app-overlay-scrim fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="ui-dialog-surface fixed left-1/2 top-1/2 z-[90] flex max-h-[min(720px,calc(100dvh-1rem))] w-[min(640px,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden">
        <DialogHeader
          description={description}
          title={title}
          onClose={onClose}
        />
        {subtitle ? (
          <div className="mx-5 mb-3 border-l-2 border-rose-300/50 pl-3 text-sm text-rose-100">
            {subtitle}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {messages.length === 0 ? (
            <div className="grid min-h-48 place-items-center border-y border-dashed border-white/10 px-5 text-center text-sm font-semibold text-white/45">
              {emptyLabel}
            </div>
          ) : (
            <div className="divide-y divide-white/10 border-y border-white/10">
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
  const authorName = identityPrimaryDisplayName(
    identityDisplayName(message.authorIdentityId, identityNames),
  );
  const authorPicture = identityPictures[message.authorIdentityId];

  return (
    <article className="py-4">
      <button
        type="button"
        disabled={!onMessageOpen}
        onClick={() => onMessageOpen?.(message)}
        className="flex w-full min-w-0 gap-3 text-left disabled:cursor-default"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-xs font-black text-slate-950">
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
          <span className="mt-1.5 block line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-white/80">
            {content}
          </span>
        </span>
      </button>
      {actions.length > 0 ? (
        <div className="mt-2 flex justify-end">
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              onClick={() => action.onClick(message)}
              className={
                action.tone === 'danger'
                  ? 'ui-button h-8 px-3 text-xs text-rose-200 hover:bg-rose-500/10'
                  : 'ui-button h-8 px-3 text-xs'
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
