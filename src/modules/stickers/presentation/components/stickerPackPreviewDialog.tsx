import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  Session,
  StickerMessageReference,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
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
      setError(toUserErrorMessage(caught, 'Sticker pack could not be loaded.'));
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
        await pigeonApplication.unsaveStickerPack(session, sticker.packId);
      } else {
        await pigeonApplication.saveStickerPack(session, sticker.packId);
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
      setError(toUserErrorMessage(caught, 'Sticker pack could not be saved.'));
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
      className="fixed inset-0 z-[170] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#17171d] p-5 text-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
              Sticker pack
            </div>
            <h2 className="truncate text-xl font-black">
              {pack?.name ?? 'Sticker pack'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15"
          >
            x
          </button>
        </div>
        {error && (
          <div className="mb-3 rounded-xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {loading ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">
            Loading...
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void sendSticker(sticker)}
              className="mb-4 flex w-full justify-center rounded-2xl bg-white/5 p-4 transition hover:bg-white/10"
              title="Send sticker"
            >
              <img
                src={stickerAssetUrl(sticker.assetCid)}
                alt="Sticker"
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
                    className="grid aspect-square place-items-center rounded-xl bg-black/20 p-1 transition hover:bg-white/10"
                    title="Send sticker"
                  >
                    <img
                      src={stickerAssetUrl(packSticker.assetCid)}
                      alt="Sticker"
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
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-45"
            >
              {saved ? 'Remove sticker pack' : 'Add sticker pack'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
