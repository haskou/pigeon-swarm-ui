import { FormEvent, useEffect, useState } from 'react';

import type {
  MyStickersResource,
  Session,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { type StickerGridItem } from './stickerPickerParts';
import { MyPacksPanel, SavedPacksPanel } from './stickerManagerPanels';
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
  onSavePack,
  onStickerDelete,
  onStickerCreated,
  savedPackIds,
  session,
}: StickerManagerDialogProps) {
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

  const [packName, setPackName] = useState('');
  const [mode, setMode] = useState<'create' | 'mine' | 'saved'>('mine');
  const [packSearch, setPackSearch] = useState('');
  const [packSearchResults, setPackSearchResults] = useState<
    StickerPackResource[]
  >([]);
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
          const unsavedPacks = packs.filter(
            (pack) => !savedPackIds.has(pack.id),
          );
          const matchingPacks = normalizedQuery
            ? unsavedPacks.filter((pack) =>
                pack.name.toLowerCase().includes(normalizedQuery),
              )
            : unsavedPacks.slice(0, 2);

          setPackSearchResults(matchingPacks);
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(toUserErrorMessage(caught, copy.stickers.searchError));
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
      setError(toUserErrorMessage(caught, copy.stickers.saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="app-overlay-scrim fixed inset-0 z-[160] grid place-items-stretch bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      data-state={transitionState}
      onMouseDown={close}
    >
      <div
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface flex h-[100dvh] w-full flex-col overflow-hidden text-white sm:h-[86vh] sm:max-w-3xl"
        data-state={transitionState}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader
          description={copy.stickers.managerDescription}
          title={copy.stickers.title}
          onClose={close}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="ui-inline-notice mb-3 border-rose-300/25 bg-rose-500/10 text-sm text-rose-100">
              {error}
            </div>
          )}
          <SegmentedControl
            className="mb-4"
            columns={3}
            dense
            value={mode}
            onChange={setMode}
            options={[
              { label: copy.stickers.savedPacks, value: 'saved' },
              { label: copy.stickers.myPacks, value: 'mine' },
              { label: copy.stickers.createPack, value: 'create' },
            ]}
          />

          {mode === 'create' ? (
            <form
              onSubmit={submitPack}
              className="grid gap-2 border-y border-white/10 py-4 sm:grid-cols-[1fr_auto]"
            >
              <input
                value={packName}
                onChange={(event) => setPackName(event.target.value)}
                className="ui-field-control px-3 py-2 text-sm"
                placeholder={copy.stickers.packName}
              />
              <button
                type="submit"
                disabled={saving || !packName.trim()}
                className="ui-button ui-button-primary"
              >
                {copy.stickers.create}
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
        </div>
      </div>
    </div>
  );
}
