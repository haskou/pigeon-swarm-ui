import { useState } from 'react';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { useAttachmentDownload } from '../../../attachments/presentation/hooks/useAttachmentDownload';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../identities/presentation/view-models/identityDisplay';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';

export function MessageThreadPanel({
  currentIdentityId,
  disabled = false,
  draft,
  embedded = false,
  error,
  identityNames,
  identityPictures = {},
  messages,
  onClose,
  onDraftChange,
  onMessageMenuOpen,
  onRootMessageOpen,
  onSend,
  onStickerSend,
  pinnedMessageIds = new Set(),
  rootMessage,
  session,
  title,
}: {
  currentIdentityId: string;
  disabled?: boolean;
  draft: string;
  embedded?: boolean;
  error?: null | string;
  identityNames: Record<string, string>;
  identityPictures?: Record<string, string | undefined>;
  messages: ChatMessage[];
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onRootMessageOpen: (message: ChatMessage) => void;
  onSend: (
    content: string,
    attachments: File[],
    options: AttachmentUploadOptions,
  ) => Promise<void>;
  onStickerSend?: (sticker: StickerMessageReference) => Promise<void>;
  pinnedMessageIds?: ReadonlySet<string>;
  rootMessage: ChatMessage;
  session: Session;
  title: string;
}) {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [, setAttachmentProgress] = useState<AttachmentProgress | null>(null);
  const { loadAttachmentPreview, openAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setAttachmentError,
    onProgressChange: setAttachmentProgress,
  });
  const displayName = (identityId: string) =>
    identityPrimaryDisplayName(identityDisplayName(identityId, identityNames));
  const rootAuthorName = displayName(rootMessage.authorIdentityId);
  const rootMine =
    rootMessage.mine || rootMessage.authorIdentityId === currentIdentityId;

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
        <div className="mt-4">
          <MessageBubble
            authorName={rootAuthorName}
            authorPicture={identityPictures[rootMessage.authorIdentityId]}
            currentIdentityId={currentIdentityId}
            message={rootMessage}
            onAttachmentOpen={(attachmentIndex) =>
              void openAttachment(rootMessage.attachments[attachmentIndex])
            }
            onAttachmentPreview={loadAttachmentPreview}
            onAvatarClick={() => undefined}
            onMessageClick={onRootMessageOpen}
            onMessageMenuOpen={onMessageMenuOpen}
            onReplyReferenceClick={() => undefined}
            onStickerClick={() => undefined}
            pinned={pinnedMessageIds.has(rootMessage.id)}
            reserveAvatarSpace={false}
            showReplyPreview={false}
            showAvatar={!rootMine}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-white/45">
            {copy.messages.emptyThread}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                authorName={displayName(message.authorIdentityId)}
                authorPicture={identityPictures[message.authorIdentityId]}
                currentIdentityId={currentIdentityId}
                key={message.id}
                message={message}
                onAttachmentOpen={(attachmentIndex) =>
                  void openAttachment(message.attachments[attachmentIndex])
                }
                onAttachmentPreview={loadAttachmentPreview}
                onAvatarClick={() => undefined}
                onMessageMenuOpen={onMessageMenuOpen}
                onReplyReferenceClick={() => undefined}
                pinned={pinnedMessageIds.has(message.id)}
                reserveAvatarSpace={false}
                showReplyPreview={false}
                showAvatar={message.authorIdentityId !== currentIdentityId}
                onStickerClick={() => undefined}
              />
            ))}
          </div>
        )}
      </div>

      <Composer
        disabled={disabled}
        draft={draft}
        error={error ?? attachmentError}
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
