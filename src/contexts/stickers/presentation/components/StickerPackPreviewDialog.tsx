import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  Session,
  StickerMessageReference,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { stickerAssetUrl } from './stickerPressPreview';
import {
  cachedGetMyStickers,
  cachedGetStickerPack,
  invalidateStickerCaches,
} from './stickerLibraryCache';

export function StickerPackPreviewDialog({
  onClose,
  onStickerSend,
  session,
  sticker,
}: {
  onClose: () => void;
  onStickerSend: (sticker: StickerMessageReference) => Promise<void>;
  session: Session;
  sticker: StickerMessageReference;
}) {
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const [pack, setPack] = useState<StickerPackResource | null>(null);
  const [savedPackIds, setSavedPackIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = savedPackIds.has(sticker.packId);

  const loadPack = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPack, library] = await Promise.all([
        cachedGetStickerPack(sticker.packId),
        cachedGetMyStickers(session),
      ]);

      setPack(nextPack);
      setSavedPackIds(
        new Set(library.savedPacks.map((savedPack) => savedPack.id)),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.stickers.packLoadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPack();
  }, [sticker.packId]);

  const toggleSaved = async () => {
    setSaving(true);
    setError(null);
    try {
      if (saved) {
        await applicationContainer.unsaveStickerPack(session, sticker.packId);
      } else {
        await applicationContainer.saveStickerPack(session, sticker.packId);
      }
      invalidateStickerCaches();

      setSavedPackIds((current) => {
        const next = new Set(current);

        if (saved) {
          next.delete(sticker.packId);
        } else {
          next.add(sticker.packId);
        }

        return next;
      });
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.stickers.saveError));
    } finally {
      setSaving(false);
    }
  };
  const sendSticker = async (nextSticker: StickerMessageReference) => {
    await onStickerSend(nextSticker);
    onClose();
  };

  return createPortal(
    <div
      className="app-overlay-scrim fixed inset-0 z-[170] grid place-items-stretch bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      data-state={transitionState}
      onMouseDown={close}
    >
      <div
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface flex h-[100dvh] w-full flex-col overflow-hidden text-white sm:h-auto sm:max-h-[86vh] sm:max-w-lg"
        data-state={transitionState}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader
          kicker={copy.stickers.stickerPack}
          title={pack?.name ?? copy.stickers.stickerPack}
          onClose={close}
        />
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {error && (
            <div className="ui-inline-notice mb-3 border-rose-300/25 bg-rose-500/10 text-sm text-rose-100">
              {error}
            </div>
          )}
          {loading ? (
            <div className="grid min-h-40 place-items-center text-sm text-white/45">
              {copy.app.loading}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void sendSticker(sticker)}
                className="mb-4 flex w-full justify-center border-y border-white/10 p-4 transition hover:bg-white/[0.04]"
                title={copy.stickers.sendSticker}
              >
                <img
                  src={stickerAssetUrl(sticker.assetCid)}
                  alt={copy.stickers.stickerAlt}
                  decoding="async"
                  className="max-h-48 max-w-full object-contain"
                />
              </button>
              {pack && pack.stickers.length > 0 && (
                <div className="mb-4 grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {pack.stickers.map((packSticker) => (
                    <button
                      key={packSticker.id}
                      type="button"
                      onClick={() =>
                        void sendSticker({
                          assetCid: packSticker.assetCid,
                          packId: pack.id,
                          stickerId: packSticker.id,
                        })
                      }
                      className="grid aspect-square place-items-center rounded-md bg-black/20 p-1 transition hover:bg-white/10"
                      title={copy.stickers.sendSticker}
                    >
                      <img
                        src={stickerAssetUrl(packSticker.assetCid)}
                        alt={copy.stickers.stickerAlt}
                        decoding="async"
                        loading="lazy"
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => void toggleSaved()}
                disabled={saving}
                className="ui-button ui-button-primary w-full"
              >
                {saved
                  ? copy.stickers.removeStickerPack
                  : copy.stickers.addStickerPack}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
