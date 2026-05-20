import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

import type {
  MyStickersResource,
  Session,
  StickerPackResource,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { cx } from '../../utils/classNameHelper';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { StickerGrid, type StickerGridItem } from './StickerPickerParts';
import { stickerAssetUrl } from './StickerPressPreview';
import {
  cachedListStickerPacks,
  invalidateStickerCaches,
} from './stickerLibraryCache';
import {
  prepareStickerFile,
  stickerTypeFromUpload,
} from './stickerUploadPreparation';

type StickerManagerDialogProps = {
  favoriteIds: Set<string>;
  favoriteItems: StickerGridItem[];
  library: MyStickersResource | null;
  onClose: () => void;
  onCreatePack: (input: { name: string }) => Promise<void>;
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSavePack: (packId: string, saved: boolean) => Promise<void>;
  onStickerDelete: (packId: string, stickerId: string) => Promise<void>;
  onStickerCreated: () => Promise<void>;
  savedPackIds: Set<string>;
  session: Session;
};

export function StickerManagerDialog({
  favoriteIds,
  favoriteItems,
  library,
  onClose,
  onCreatePack,
  onFavoriteToggle,
  onRefresh,
  onSavePack,
  onStickerDelete,
  onStickerCreated,
  savedPackIds,
  session,
}: StickerManagerDialogProps) {
  const [packName, setPackName] = useState('');
  const [mode, setMode] = useState<'create' | 'mine' | 'saved'>('mine');
  const [packSearch, setPackSearch] = useState('');
  const [packSearchResults, setPackSearchResults] =
    useState<StickerPackResource[]>([]);
  const [searchingPacks, setSearchingPacks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownPacks =
    library?.savedPacks.filter(
      (pack) => pack.ownerIdentityId === session.identity.id,
    ) ?? [];
  const savedPacks =
    library?.savedPacks.filter(
      (pack) => pack.ownerIdentityId !== session.identity.id,
    ) ?? [];

  useEffect(() => {
    if (mode !== 'saved') return undefined;

    let cancelled = false;
    const searchDelay = packSearch.trim() ? 180 : 0;
    const timeoutId = window.setTimeout(() => {
      setSearchingPacks(true);
      setError(null);
      void cachedListStickerPacks()
        .then((packs) => {
          if (cancelled) return;

          const normalizedQuery = packSearch.trim().toLowerCase();
          const unsavedPacks = packs.filter((pack) => !savedPackIds.has(pack.id));
          const matchingPacks = normalizedQuery
            ? unsavedPacks.filter((pack) =>
                pack.name.toLowerCase().includes(normalizedQuery),
              )
            : unsavedPacks.slice(0, 2);

          setPackSearchResults(matchingPacks);
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(
              toUserErrorMessage(caught, 'Sticker packs could not be found.'),
            );
          }
        })
        .finally(() => {
          if (!cancelled) setSearchingPacks(false);
        });
    }, searchDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [mode, packSearch, savedPackIds]);

  const submitPack = async (event: FormEvent) => {
    event.preventDefault();
    if (!packName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await onCreatePack({
        name: packName.trim(),
      });
      setPackName('');
      setMode('mine');
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'Sticker pack could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[160] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#17171d] p-5 text-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black">Stickers</h2>
            <p className="text-sm text-white/45">
              Create packs, upload stickers, manage favorites and saved packs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15"
          >
            ×
          </button>
        </div>
        {error && (
          <div className="mb-3 rounded-xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/20 p-1">
          <ManagerModeButton
            active={mode === 'saved'}
            onClick={() => setMode('saved')}
          >
            Saved packs
          </ManagerModeButton>
          <ManagerModeButton
            active={mode === 'mine'}
            onClick={() => setMode('mine')}
          >
            My packs
          </ManagerModeButton>
          <ManagerModeButton
            active={mode === 'create'}
            onClick={() => setMode('create')}
          >
            Create pack
          </ManagerModeButton>
        </div>

        {mode === 'create' ? (
          <form
            onSubmit={submitPack}
            className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 sm:grid-cols-[1fr_auto]"
          >
            <input
              value={packName}
              onChange={(event) => setPackName(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
              placeholder="Pack name"
            />
            <button
              type="submit"
              disabled={saving || !packName.trim()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-45"
            >
              Create
            </button>
          </form>
        ) : mode === 'mine' ? (
          <MyPacksPanel
            onStickerCreated={onStickerCreated}
            onStickerDelete={onStickerDelete}
            ownPacks={ownPacks}
            session={session}
          />
        ) : (
          <SavedPacksPanel
            favoriteIds={favoriteIds}
            favoriteItems={favoriteItems}
            onFavoriteToggle={onFavoriteToggle}
            onSavePack={onSavePack}
            packSearch={packSearch}
            packSearchResults={packSearchResults}
            savedPackIds={savedPackIds}
            savedPacks={savedPacks}
            searchingPacks={searchingPacks}
            setPackSearch={setPackSearch}
          />
        )}
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function ManagerModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl px-3 py-2 text-sm font-black transition',
        active ? 'bg-white text-slate-950' : 'text-white/55 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function MyPacksPanel({
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
        Create a pack first to upload stickers.
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        My packs
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

function SavedPacksPanel({
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
          placeholder="Search sticker packs"
        />
        {searchingPacks && (
          <div className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-white/35">
            Searching...
          </div>
        )}
      </div>
      {packSearchResults.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {packSearch.trim() ? 'Search results' : 'Suggested packs'}
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
      {packSearch.trim() && !searchingPacks && packSearchResults.length === 0 && (
        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
          No packs found.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            Saved packs
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
                No saved packs yet.
              </div>
            )}
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            Favorites
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
            pigeonApplication.uploadStickerAsset(session, preparedSticker.file),
            Promise.resolve(preparedSticker.dimensions),
          ]);

          await pigeonApplication.addStickerToPack(session, pack.id, {
            assetCid: upload.cid,
            contentType: upload.contentType,
            dimensions,
            sizeBytes: upload.size,
            type: stickerTypeFromUpload(upload),
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
              alt="Sticker"
              className="aspect-square w-full rounded-xl bg-black/20 object-contain p-1"
            />
            <button
              type="button"
              onClick={() => void onStickerDelete(pack.id, sticker.id)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-xs font-black text-white/70 opacity-0 transition hover:text-white group-hover:opacity-100"
              aria-label="Delete sticker"
            >
              ×
            </button>
          </div>
        ))}
        <label
          className={cx(
            'grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-white/15 bg-black/20 text-2xl font-black text-white/45 transition hover:border-white/30 hover:bg-white/10 hover:text-white/80',
            uploading && 'pointer-events-none opacity-50',
          )}
          aria-label="Add sticker"
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
          {saved ? 'Remove' : 'Save'}
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
