import type {
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  stickerAssetUrl,
  useStickerPressPreview,
} from '../../../stickers/presentation/components/stickerPressPreview';

export function MessageStickerContent({
  mine,
  onStickerClick,
  sticker,
}: {
  mine: boolean;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  sticker: StickerMessageReference;
}) {
  const stickerPreview = useStickerPressPreview(sticker.assetCid);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (stickerPreview.consumePreviewClick()) return;

          onStickerClick?.(sticker);
        }}
        className={cx(
          'flex w-full touch-none select-none rounded-2xl p-0.5 transition hover:bg-white/10',
          mine ? 'justify-end' : 'justify-start',
        )}
        title="View sticker pack"
        {...stickerPreview.pressPreviewHandlers}
      >
        <img
          src={stickerAssetUrl(sticker.assetCid)}
          alt="Sticker"
          className="max-h-40 max-w-40 object-contain sm:max-h-48 sm:max-w-48"
          draggable={false}
        />
      </button>
      {stickerPreview.previewPortal}
    </>
  );
}

export function MessageAttachmentProgress({
  progress,
}: {
  progress: NonNullable<ChatMessage['attachmentProgress']>;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-black/20 p-3 text-left text-xs font-black text-white/75">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">
          {attachmentProgressLabel(progress.phase)} {progress.filename}
        </span>
        <span className="shrink-0">{progress.percent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-fuchsia-400"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

export function MessageDeliveryStatus({
  message,
  onRetryMessage,
}: {
  message: ChatMessage;
  onRetryMessage?: (message: ChatMessage) => void;
}) {
  if (message.deliveryStatus !== 'failed') return null;

  return (
    <div className="mt-1 flex items-center justify-end gap-2 text-xs font-black opacity-65">
      <span className="text-rose-100">{copy.messages.sendFailed}</span>
      {onRetryMessage && (
        <button
          type="button"
          onClick={() => onRetryMessage(message)}
          className="rounded-full bg-white/15 px-2 py-0.5 text-white transition hover:bg-white/25"
        >
          {copy.messages.retrySend}
        </button>
      )}
    </div>
  );
}

function attachmentProgressLabel(
  phase: NonNullable<ChatMessage['attachmentProgress']>['phase'],
): string {
  if (phase === 'encrypt') return copy.composer.encryptingAttachment;
  if (phase === 'upload') return copy.composer.uploadingAttachment;
  if (phase === 'download') return copy.composer.downloadingAttachment;

  return copy.composer.decryptingAttachment;
}
