import { ChangeEvent, useState } from 'react';

import type {
  Session,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { StickerGrid, type StickerGridItem } from './stickerPickerParts';
import { stickerAssetUrl } from './stickerPressPreview';
import { invalidateStickerCaches } from './stickerLibraryCache';
import { prepareStickerFile } from './stickerUploadPreparation';

export function MyPacksPanel({
  onStickerCreated,
  onStickerDelete,
  ownPacks,
  session,
}: {
  onStickerCreated: () => Promise<void>;
  onStickerDelete: (packId: string, stickerId: string) => Promise<void>;
  ownPacks: StickerPackResource[];
  session: Session;
}) {
  if (ownPacks.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
        {copy.stickers.createPackFirst}
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.stickers.myPacks}
      </div>
      <div className="grid gap-3">
        {ownPacks.map((pack) => (
          <ManagePackStickers
            key={pack.id}
            onStickerCreated={onStickerCreated}
            onStickerDelete={onStickerDelete}
            pack={pack}
            session={session}
          />
        ))}
      </div>
    </section>
  );
}

export function SavedPacksPanel({
  favoriteIds,
  favoriteItems,
  onFavoriteToggle,
  onSavePack,
  packSearch,
  packSearchResults,
  savedPackIds,
  savedPacks,
  searchingPacks,
  setPackSearch,
}: {
  favoriteIds: Set<string>;
  favoriteItems: StickerGridItem[];
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onSavePack: (packId: string, saved: boolean) => Promise<void>;
  packSearch: string;
  packSearchResults: StickerPackResource[];
  savedPackIds: Set<string>;
  savedPacks: StickerPackResource[];
  searchingPacks: boolean;
  setPackSearch: (query: string) => void;
}) {
  return (
    <>
      <div className="mb-4">
        <input
          value={packSearch}
          onChange={(event) => setPackSearch(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
          placeholder={copy.stickers.searchPacks}
        />
        {searchingPacks && (
          <div className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-white/35">
            {copy.stickers.searching}
          </div>
        )}
      </div>
      {packSearchResults.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {packSearch.trim()
              ? copy.stickers.searchResults
              : copy.stickers.suggestedPacks}
          </div>
          <div className="grid gap-2">
            {packSearchResults.map((pack) => (
              <PackRow
                key={pack.id}
                pack={pack}
                saved={savedPackIds.has(pack.id)}
                onSavePack={onSavePack}
              />
            ))}
          </div>
        </section>
      )}
      {packSearch.trim() &&
        !searchingPacks &&
        packSearchResults.length === 0 && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
            {copy.stickers.noPacksFound}
          </div>
        )}
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.stickers.savedPacks}
          </div>
          <div className="grid gap-2">
            {savedPacks.map((pack) => (
              <PackRow
                key={pack.id}
                pack={pack}
                saved={savedPackIds.has(pack.id)}
                onSavePack={onSavePack}
              />
            ))}
            {savedPacks.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
                {copy.stickers.noSavedPacks}
              </div>
            )}
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.stickers.favorites}
          </div>
          <StickerGrid
            favoriteIds={favoriteIds}
            items={favoriteItems}
            onFavoriteToggle={onFavoriteToggle}
            onSend={async () => undefined}
          />
        </section>
      </div>
    </>
  );
}

function ManagePackStickers({
  onStickerCreated,
  onStickerDelete,
  pack,
  session,
}: {
  onStickerCreated: () => Promise<void>;
  onStickerDelete: (packId: string, stickerId: string) => Promise<void>;
  pack: StickerPackResource;
  session: Session;
}) {
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = uploadProgress !== null;

  const uploadSticker = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setUploadProgress({ current: 0, total: files.length });
    setError(null);
    const failedFiles: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress({ current: index + 1, total: files.length });

        try {
          const preparedSticker = await prepareStickerFile(file);
          const [upload, dimensions] = await Promise.all([
            applicationContainer.uploadStickerAsset(
              session,
              preparedSticker.file,
            ),
            Promise.resolve(preparedSticker.dimensions),
          ]);

          await applicationContainer.addStickerToPack(session, pack.id, {
            assetCid: upload.cid,
            contentType: upload.contentType,
            dimensions,
            sizeBytes: upload.size,
            type: preparedSticker.type,
          });
        } catch {
          failedFiles.push(file.name);
        }
      }

      invalidateStickerCaches();
      await onStickerCreated();

      if (failedFiles.length > 0) {
        setError(
          `${failedFiles.length} sticker${failedFiles.length === 1 ? '' : 's'} could not be uploaded: ${failedFiles.join(', ')}`,
        );
      }
    } finally {
      setUploadProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 truncate text-sm font-black">{pack.name}</div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {pack.stickers.map((sticker) => (
          <div key={sticker.id} className="group relative">
            <img
              src={stickerAssetUrl(sticker.assetCid)}
              alt={copy.stickers.stickerAlt}
              className="aspect-square w-full rounded-xl bg-black/20 object-contain p-1"
            />
            <button
              type="button"
              onClick={() => void onStickerDelete(pack.id, sticker.id)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-xs font-black text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
              aria-label={copy.stickers.deleteSticker}
            >
              x
            </button>
          </div>
        ))}
        <label
          className={cx(
            'grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-white/15 bg-black/20 text-2xl font-black text-white/45 transition hover:border-white/30 hover:bg-white/10 hover:text-white/80',
            uploading && 'pointer-events-none opacity-50',
          )}
          aria-label={copy.stickers.addSticker}
        >
          {uploading ? (
            <span className="text-xs font-black uppercase tracking-[0.12em]">
              {uploadProgress?.current}/{uploadProgress?.total}
            </span>
          ) : (
            '+'
          )}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={uploadSticker}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>
      {error && <div className="mt-2 text-sm text-rose-100">{error}</div>}
    </div>
  );
}

function PackRow({
  onSavePack,
  pack,
  saved,
}: {
  onSavePack: (packId: string, saved: boolean) => Promise<void>;
  pack: StickerPackResource;
  saved: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{pack.name}</div>
        </div>
        <button
          type="button"
          onClick={() => void onSavePack(pack.id, saved)}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/15"
        >
          {saved ? copy.stickers.removePack : copy.stickers.savePack}
        </button>
      </div>
      {pack.stickers.length > 0 && (
        <div className="mt-2 flex gap-1 overflow-hidden">
          {pack.stickers.slice(0, 8).map((sticker) => (
            <img
              key={sticker.id}
              src={stickerAssetUrl(sticker.assetCid)}
              alt=""
              className="h-9 w-9 rounded-lg object-contain"
            />
          ))}
        </div>
      )}
    </div>
  );
}
