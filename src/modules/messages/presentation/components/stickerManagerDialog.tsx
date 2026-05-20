import { FormEvent, useEffect, useState } from 'react';

import type {
  MyStickersResource,
  Session,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/classNameHelper';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { type StickerGridItem } from './stickerPickerParts';
import {
  MyPacksPanel,
  SavedPacksPanel,
} from './stickerManagerPanels';
import { cachedListStickerPacks } from './stickerLibraryCache';

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
