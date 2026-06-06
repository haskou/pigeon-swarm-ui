import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type {
  MyStickersResource,
  Session,
  StickerInput,
  StickerMessageReference,
  StickerPackResource,
  StickerResource,
  StickerUsageResource,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { ClearableSearchInput } from '../../../../shared/presentation/components/ClearableSearchInput';
import { useCloseOnOutsidePointerDown } from '../../../../shared/presentation/hooks/useCloseOnOutsidePointerDown';
import {
  type EmojiSuggestion,
  preloadEmojiSuggestions,
  searchEmojiSuggestions,
} from '../../../messages/presentation/emoji/emojiShortcodes';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { StickerExplorePack } from './StickerExplorePack';
import {
  PickerTab,
  type StickerGridItem,
  StickerSection,
  type StickerShortcut,
  StickerShortcutBar,
} from './stickerPickerParts';
import {
  cachedGetMyStickers,
  cachedListStickerPacks,
  invalidateStickerCaches,
  preloadStickerAssets,
} from './stickerLibraryCache';

const StickerEmojiPanel = lazy(() =>
  import('./StickerEmojiPanel').then((module) => ({
    default: module.StickerEmojiPanel,
  })),
);
const StickerManagerDialog = lazy(() =>
  import('./StickerManagerDialog').then((module) => ({
    default: module.StickerManagerDialog,
  })),
);

type StickerPickerProps = {
  disabled: boolean;
  onEmojiInsert: (emoji: string) => void;
  onStickerSend: (sticker: StickerMessageReference) => Promise<void>;
  session: Session;
};

export function StickerPicker({
  disabled,
  onEmojiInsert,
  onStickerSend,
  session,
}: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'stickers'>('stickers');
  const [library, setLibrary] = useState<MyStickersResource | null>(null);
  const [publicPacks, setPublicPacks] = useState<StickerPackResource[]>([]);
  const [query, setQuery] = useState('');
  const [emojiQuery, setEmojiQuery] = useState('');
  const [emojis, setEmojis] = useState<EmojiSuggestion[]>([]);
  const [emojiLoading, setEmojiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [activeShortcutId, setActiveShortcutId] = useState('favorites');
  const pickerRef = useRef<HTMLDivElement>(null);
  const stickerScrollerRef = useRef<HTMLDivElement>(null);
  const stickerSectionRefs = useRef(new Map<string, HTMLDivElement>());
  const closePicker = useCallback(() => setOpen(false), []);
  const savedPackIds = useMemo(
    () => new Set(library?.savedPacks.map((pack) => pack.id) ?? []),
    [library],
  );
  const favoriteIds = useMemo(
    () =>
      new Set(
        library?.favoriteStickers.map(
          (item) => `${item.packId}:${item.stickerId}`,
        ) ?? [],
      ),
    [library],
  );
  const warmEmojiCatalog = useCallback(() => {
    void preloadEmojiSuggestions();
  }, []);

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      setLibrary(await cachedGetMyStickers(session));
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.stickers.loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    void loadLibrary();
    warmEmojiCatalog();
  }, [open]);

  useCloseOnOutsidePointerDown({
    active: open,
    onClose: closePicker,
    ref: pickerRef,
  });

  useEffect(() => {
    if (!open || tab !== 'emoji') return;

    let cancelled = false;

    setEmojiLoading(true);
    void searchEmojiSuggestions(emojiQuery, 5000)
      .then((suggestions) => {
        if (!cancelled) setEmojis(suggestions);
      })
      .catch(() => {
        if (!cancelled) setEmojis([]);
      })
      .finally(() => {
        if (!cancelled) setEmojiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [emojiQuery, open, tab]);

  const searchPacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const packs = await cachedListStickerPacks();
      const normalizedQuery = query.trim().toLowerCase();

      setPublicPacks(
        normalizedQuery
          ? packs.filter((pack) =>
              pack.name.toLowerCase().includes(normalizedQuery),
            )
          : packs,
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.stickers.searchError));
    } finally {
      setLoading(false);
    }
  };
  const searchPacksOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    void searchPacks();
  };

  const sendSticker = async (packId: string, sticker: StickerResource) => {
    await onStickerSend({
      assetCid: sticker.assetCid,
      packId,
      stickerId: sticker.id,
    });
    setOpen(false);
    void loadLibrary();
  };

  const savePack = async (packId: string, saved: boolean) => {
    if (saved) {
      await applicationContainer.unsaveStickerPack(session, packId);
    } else {
      await applicationContainer.saveStickerPack(session, packId);
    }
    invalidateStickerCaches();
    await loadLibrary();
  };

  const deleteSticker = async (packId: string, stickerId: string) => {
    await applicationContainer.deleteSticker(session, packId, stickerId);
    invalidateStickerCaches();
    await loadLibrary();
  };

  const toggleFavorite = async (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => {
    if (favorite) {
      await applicationContainer.unfavoriteSticker(session, packId, stickerId);
    } else {
      await applicationContainer.favoriteSticker(session, packId, stickerId);
    }
    invalidateStickerCaches();
    await loadLibrary();
  };

  const recentItems = useMemo(
    () => usageItems(library?.recentStickers ?? []),
    [library?.recentStickers],
  );
  const favoriteItems = useMemo(
    () => usageItems(library?.favoriteStickers ?? []),
    [library?.favoriteStickers],
  );
  const savedPacks = useMemo(
    () => library?.savedPacks ?? [],
    [library?.savedPacks],
  );
  const explorePacks = useMemo(
    () => publicPacks.filter((pack) => !savedPackIds.has(pack.id)).slice(0, 2),
    [publicPacks, savedPackIds],
  );
  const stickerShortcuts: StickerShortcut[] = useMemo(
    () => [
      { id: 'favorites', label: copy.stickers.favorites, type: 'favorites' },
      { id: 'recent', label: copy.stickers.recent, type: 'recent' },
      ...savedPacks
        .filter((pack) => pack.stickers.length > 0)
        .map((pack) => ({
          id: `pack:${pack.id}`,
          label: pack.name,
          sticker: pack.stickers[0],
          type: 'pack' as const,
        })),
    ],
    [savedPacks],
  );
  const setStickerSectionRef =
    (sectionId: string) => (node: HTMLDivElement | null) => {
      if (node) {
        stickerSectionRefs.current.set(sectionId, node);
        return;
      }

      stickerSectionRefs.current.delete(sectionId);
    };
  const scrollToStickerSection = (sectionId: string) => {
    setActiveShortcutId(sectionId);
    stickerSectionRefs.current.get(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };
  const updateActiveStickerShortcut = () => {
    const scroller = stickerScrollerRef.current;
    if (!scroller) return;

    const scrollerTop = scroller.getBoundingClientRect().top;
    let nextActiveShortcutId = activeShortcutId;
    let closestDistance = Number.POSITIVE_INFINITY;

    stickerSectionRefs.current.forEach((node, sectionId) => {
      const distance = Math.abs(node.getBoundingClientRect().top - scrollerTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextActiveShortcutId = sectionId;
      }
    });

    if (nextActiveShortcutId !== activeShortcutId) {
      setActiveShortcutId(nextActiveShortcutId);
    }
  };

  useEffect(() => {
    const assetCids = [
      ...favoriteItems.map(({ sticker }) => sticker.assetCid),
      ...recentItems.map(({ sticker }) => sticker.assetCid),
      ...savedPacks.flatMap((pack) =>
        pack.stickers.slice(0, 4).map((sticker) => sticker.assetCid),
      ),
      ...explorePacks.flatMap((pack) =>
        pack.stickers.slice(0, 4).map((sticker) => sticker.assetCid),
      ),
    ];

    preloadStickerAssets(assetCids);
  }, [explorePacks, favoriteItems, recentItems, savedPacks]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onFocus={warmEmojiCatalog}
        onPointerEnter={warmEmojiCatalog}
        disabled={disabled}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-xl text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-45"
        aria-label={copy.stickers.openPicker}
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-3 w-[min(25.625rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#17171d] text-white shadow-2xl shadow-black/40 sm:w-[min(25.625rem,calc(100vw-3rem))]">
          <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 p-2">
            <PickerTab
              active={tab === 'stickers'}
              label={copy.stickers.title}
              onClick={() => setTab('stickers')}
            />
            <PickerTab
              active={tab === 'emoji'}
              label={copy.stickers.emoji}
              onClick={() => setTab('emoji')}
            />
            {tab === 'stickers' && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="ml-auto rounded-xl px-3 py-2 text-xs font-black text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                {copy.stickers.manage}
              </button>
            )}
          </div>
          {tab === 'stickers' ? (
            <div
              className="max-h-[24rem] overflow-y-auto p-3"
              onScroll={updateActiveStickerShortcut}
              ref={stickerScrollerRef}
            >
              <StickerShortcutBar
                activeShortcutId={activeShortcutId}
                onSelect={scrollToStickerSection}
                shortcuts={stickerShortcuts}
              />
              <div
                className="mb-3"
                onKeyDown={searchPacksOnEnter}
              >
                <ClearableSearchInput
                  ariaLabel={copy.stickers.searchStickers}
                  clearLabel={copy.stickers.clearStickerSearch}
                  value={query}
                  onChange={setQuery}
                  inputClassName="rounded-xl placeholder:text-white/35"
                  placeholder={copy.stickers.searchStickers}
                />
              </div>
              {error && (
                <div className="mb-3 rounded-xl border border-rose-300/25 bg-rose-500/15 p-2 text-xs text-rose-100">
                  {error}
                </div>
              )}
              {loading && (
                <div className="p-4 text-center text-sm text-white/45">
                  {copy.app.loading}
                </div>
              )}
              <StickerSection
                favoriteIds={favoriteIds}
                items={favoriteItems}
                label={copy.stickers.favorites}
                onFavoriteToggle={toggleFavorite}
                onSend={sendSticker}
                sectionRef={setStickerSectionRef('favorites')}
                emptyText={copy.stickers.noFavorites}
              />
              <StickerSection
                favoriteIds={favoriteIds}
                items={recentItems}
                label={copy.stickers.recent}
                onFavoriteToggle={toggleFavorite}
                onSend={sendSticker}
                sectionRef={setStickerSectionRef('recent')}
                emptyText={copy.stickers.noRecent}
              />
              {savedPacks.map((pack) => (
                <StickerSection
                  key={pack.id}
                  favoriteIds={favoriteIds}
                  items={pack.stickers.map((sticker) => ({
                    packId: pack.id,
                    sticker,
                  }))}
                  label={pack.name}
                  onFavoriteToggle={toggleFavorite}
                  onSend={sendSticker}
                  sectionRef={setStickerSectionRef(`pack:${pack.id}`)}
                  emptyText={copy.stickers.emptyPack}
                />
              ))}
              {!loading &&
                savedPacks.length === 0 &&
                explorePacks.length === 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/45">
                    {copy.stickers.noStickerPacks}
                  </div>
                )}
              {explorePacks.length > 0 && (
                <div className="mt-4 grid gap-2">
                  <div className="text-center text-xs font-black uppercase tracking-[0.16em] text-white/35">
                    {copy.stickers.explore}
                  </div>
                  {explorePacks.map((pack) => (
                    <StickerExplorePack
                      favoriteIds={favoriteIds}
                      key={pack.id}
                      onFavoriteToggle={toggleFavorite}
                      onSavePack={savePack}
                      onSend={sendSticker}
                      pack={pack}
                      saved={savedPackIds.has(pack.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Suspense fallback={<StickerPanelLoading />}>
              <StickerEmojiPanel
                emojiQuery={emojiQuery}
                emojis={emojis}
                loading={emojiLoading}
                onEmojiInsert={(emoji) => {
                  onEmojiInsert(emoji);
                  setOpen(false);
                }}
                onQueryChange={setEmojiQuery}
              />
            </Suspense>
          )}
        </div>
      )}
      {manageOpen &&
        createPortal(
          <Suspense fallback={<StickerManagerLoading />}>
            <StickerManagerDialog
              favoriteIds={favoriteIds}
              favoriteItems={favoriteItems}
              library={library}
              onClose={() => setManageOpen(false)}
              onCreatePack={async (input) => {
                await applicationContainer.createStickerPack(session, input);
                invalidateStickerCaches();
                await loadLibrary();
              }}
              onFavoriteToggle={toggleFavorite}
              onRefresh={async () => {
                invalidateStickerCaches();
                await loadLibrary();
              }}
              onSavePack={savePack}
              onStickerDelete={deleteSticker}
              onStickerCreated={loadLibrary}
              savedPackIds={savedPackIds}
              session={session}
            />
          </Suspense>,
          document.body,
        )}
    </div>
  );
}

function usageItems(items: StickerUsageResource[]): StickerGridItem[] {
  return items.map((item) => ({
    packId: item.packId,
    sticker: item.sticker,
  }));
}

function StickerPanelLoading() {
  return (
    <div className="grid h-[24rem] max-h-[calc(100dvh-8rem)] place-items-center p-3 text-sm text-white/45">
      {copy.app.loading}
    </div>
  );
}

function StickerManagerLoading() {
  return (
    <div className="fixed inset-0 z-[160] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-[#17171d] px-5 py-4 text-sm text-white/45 shadow-2xl">
        {copy.app.loading}
      </div>
    </div>
  );
}
