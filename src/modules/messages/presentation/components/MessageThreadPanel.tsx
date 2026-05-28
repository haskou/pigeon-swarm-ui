import type {
  AttachmentUploadOptions,
  ChatMessage,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { identityDisplayName } from '../../../identities/presentation/view-models/identityDisplay';
import { Composer } from './Composer';

export function MessageThreadPanel({
  currentIdentityId,
  disabled = false,
  draft,
  error,
  identityNames,
  messages,
  onClose,
  onDraftChange,
  onSend,
  onStickerSend,
  rootMessage,
  session,
  title,
  embedded = false,
}: {
  currentIdentityId: string;
  disabled?: boolean;
  draft: string;
  embedded?: boolean;
  error?: null | string;
  identityNames: Record<string, string>;
  messages: ChatMessage[];
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSend: (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => Promise<void>;
  onStickerSend?: (sticker: StickerMessageReference) => Promise<void>;
  rootMessage: ChatMessage;
  session: Session;
  title: string;
}) {
  return (
    <section
      className={
        embedded
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
          : 'glass-panel-strong app-safe-area-panel flex h-full min-h-0 flex-col overflow-hidden rounded-none'
      }
    >
      <header className="shrink-0 border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-black uppercase tracking-[0.18em] text-white/35">
              {copy.messages.thread}
            </div>
            <h2 className="mt-1 truncate text-lg font-black text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/8 text-xl font-black text-white/70 transition hover:bg-white/12 hover:text-white"
            aria-label={copy.dialog.close}
          >
            ×
          </button>
        </div>
        <ThreadRootCard
          identityNames={identityNames}
          message={rootMessage}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-white/45">
            {copy.messages.emptyThread}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <ThreadReply
                currentIdentityId={currentIdentityId}
                identityNames={identityNames}
                key={message.id}
                message={message}
              />
            ))}
          </div>
        )}
      </div>

      <Composer
        disabled={disabled}
        draft={draft}
        error={error ?? null}
        focusKey={`thread:${rootMessage.id}`}
        onCancelEdit={() => undefined}
        onDraftChange={onDraftChange}
        onEdit={async () => undefined}
        onEscape={onClose}
        onSend={onSend}
        onStickerSend={onStickerSend}
        placeholder={copy.composer.placeholder}
        session={session}
      />
    </section>
  );
}

function ThreadRootCard({
  identityNames,
  message,
}: {
  identityNames: Record<string, string>;
  message: ChatMessage;
}) {
  return (
    <div className="mt-4 flex gap-3">
      <div className="w-5 shrink-0 border-l-2 border-b-2 border-white/20" />
      <div className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-2">
        <div className="truncate text-sm font-black text-white">
          {messageSummary(message)}
        </div>
        <div className="mt-1 truncate text-xs font-semibold text-white/45">
          {identityDisplayName(message.authorIdentityId, identityNames)}
        </div>
      </div>
    </div>
  );
}

function ThreadReply({
  currentIdentityId,
  identityNames,
  message,
}: {
  currentIdentityId: string;
  identityNames: Record<string, string>;
  message: ChatMessage;
}) {
  const mine = message.authorIdentityId === currentIdentityId;

  return (
    <article className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          mine
            ? 'max-w-[88%] rounded-2xl bg-[#274279] px-3 py-2 text-white'
            : 'max-w-[88%] rounded-2xl bg-white/10 px-3 py-2 text-white/90'
        }
      >
        <div className="mb-1 flex items-baseline gap-2 text-xs">
          <span className="font-black text-white/75">
            {identityDisplayName(message.authorIdentityId, identityNames)}
          </span>
          <span className="text-white/35">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm font-semibold leading-5">
          {messageSummary(message)}
        </div>
      </div>
    </article>
  );
}

function messageSummary(message: ChatMessage): string {
  if (message.kind === 'poll') return message.poll?.question ?? copy.polls.poll;

  if (message.sticker) return copy.stickers.stickerAlt;

  if (message.content.trim()) return message.content;

  if (message.attachments.length > 0) {
    return message.attachments.map((attachment) => attachment.filename).join(', ');
  }

  return copy.messages.originalMessage;
}
