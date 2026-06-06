import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { stickerAssetUrl } from '../../../stickers/presentation/components/stickerPressPreview';

interface ComposerContextBannerProps {
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onCancelReply?: () => void;
  replyTo?: ChatMessage | null;
  replyToAuthorName?: string;
}

export function ComposerContextBanner({
  editingMessage,
  onCancelEdit,
  onCancelReply,
  replyTo,
  replyToAuthorName,
}: ComposerContextBannerProps) {
  if (editingMessage) {
    return (
      <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-sky-300/25 bg-sky-500/15 p-3 text-sm text-sky-50">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase text-sky-100/70">
            {copy.messages.editing}
          </div>
          <div className="mt-1 truncate text-white/80">
            {editingMessage.content}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelEdit}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/10 font-black text-white/80 transition hover:bg-white/15"
          aria-label={copy.messages.cancelEdit}
        >
          ×
        </button>
      </div>
    );
  }

  if (!replyTo) return null;

  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/15 p-3 text-sm text-fuchsia-50">
      <div className="flex min-w-0 items-center gap-2">
        {replyTo.sticker && (
          <img
            src={stickerAssetUrl(replyTo.sticker.assetCid)}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-contain"
          />
        )}
        <div className="min-w-0">
          <div className="text-xs font-black uppercase text-fuchsia-100/70">
            {copy.messages.replyingTo}{' '}
            {replyToAuthorName ?? replyTo.authorIdentityId}
          </div>
          {replyTo.content ? (
            <div className="mt-1 truncate text-white/80">{replyTo.content}</div>
          ) : replyTo.sticker ? (
            <div className="mt-1 truncate text-white/80">Sticker</div>
          ) : null}
        </div>
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
  );
}
