import { useEffect, useState } from 'react';

import type {
  AttachmentProgress,
  MessageAttachment,
  StickerMessageReference,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { stickerAssetUrl } from './StickerPressPreview';

export function MessageReplyPreview({
  mine,
  onAttachmentPreview,
  onReplyReferenceClick,
  replyAuthorName,
  replyImage,
  replyMessageId,
  replyPreview,
  replySticker,
}: {
  mine: boolean;
  onAttachmentPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  onReplyReferenceClick: (messageId: string) => void;
  replyAuthorName?: string;
  replyImage?: MessageAttachment;
  replyMessageId: string;
  replyPreview?: string;
  replySticker?: StickerMessageReference;
}) {
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!replyImage) {
      setReplyImageUrl(null);

      return;
    }

    let cancelled = false;
    let loadedUrl: string | null = null;

    setReplyImageUrl(null);
    void onAttachmentPreview(replyImage)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        loadedUrl = url;
        setReplyImageUrl(url);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;

      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    };
  }, [onAttachmentPreview, replyImage]);

  return (
    <button
      type="button"
      onClick={() => onReplyReferenceClick(replyMessageId)}
      className={cx(
        'mb-2 block max-w-full rounded-2xl border px-3 py-2 text-left text-xs transition',
        mine
          ? 'border-white/20 bg-white/10 hover:bg-white/15'
          : 'border-fuchsia-300/20 bg-fuchsia-400/10 hover:bg-fuchsia-400/15',
      )}
    >
      <span className="flex items-center gap-2">
        {replyImageUrl && (
          <img
            src={replyImageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        )}
        {replySticker && (
          <img
            src={stickerAssetUrl(replySticker.assetCid)}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-contain"
          />
        )}
        <span className="min-w-0">
          <span className="block font-black text-white/75">
            {copy.messages.replyTo}{' '}
            {replyAuthorName ?? copy.messages.originalMessage}
          </span>
          {replyPreview ? (
            <span className="block truncate text-white/55">{replyPreview}</span>
          ) : replySticker ? (
            <span className="block truncate text-white/55">Sticker</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
