import { useEffect, useMemo, useRef, useState } from 'react';
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

import { pigeonApplication } from '../../../../app/composition/applicationContainer';
import { cx } from '../../../../shared/presentation/classNameHelper';
import {
  type EmojiSuggestion,
  searchEmojiSuggestions,
} from '../../../messages/presentation/emoji/emojiShortcodes';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { StickerEmojiPanel } from './stickerEmojiPanel';
import { StickerExplorePack } from './stickerExplorePack';
import { StickerManagerDialog } from './stickerManagerDialog';
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
  preloadStickerAsset,
} from './stickerLibraryCache';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [activeShortcutId, setActiveShortcutId] = useState('favorites');
  const pickerRef = useRef<HTMLDivElement>(null);
  const stickerScrollerRef = useRef<HTMLDivElement>(null);
  const stickerSectionRefs = useRef(new Map<string, HTMLDivElement>());
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

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);
    try {
      setLibrary(await cachedGetMyStickers(session));
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'Stickers could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    void loadLibrary();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && pickerRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'emoji') return;

    let cancelled = false;

    void searchEmojiSuggestions(emojiQuery, 5000).then((suggestions) => {
      if (!cancelled) setEmojis(suggestions);
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
      setError(toUserErrorMessage(caught, 'Sticker packs could not be found.'));
    } finally {
      setLoading(false);
    }
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
      await pigeonApplication.unsaveStickerPack(session, packId);
    } else {
      await pigeonApplication.saveStickerPack(session, packId);
    }
    invalidateStickerCaches();
    await loadLibrary();
  };

  const deleteSticker = async (packId: string, stickerId: string) => {
    await pigeonApplication.deleteSticker(session, packId, stickerId);
    invalidateStickerCaches();
    await loadLibrary();
  };

  const toggleFavorite = async (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => {
    if (favorite) {
      await pigeonApplication.unfavoriteSticker(session, packId, stickerId);
    } else {
      await pigeonApplication.favoriteSticker(session, packId, stickerId);
    }
    invalidateStickerCaches();
    await loadLibrary();
  };

  const recentItems = usageItems(library?.recentStickers ?? []);
  const favoriteItems = usageItems(library?.favoriteStickers ?? []);
  const savedPacks = library?.savedPacks ?? [];
  const explorePacks = publicPacks
    .filter((pack) => !savedPackIds.has(pack.id))
    .slice(0, 2);
  const stickerShortcuts: StickerShortcut[] = [
    { id: 'favorites', label: 'Favorites', type: 'favorites' },
    { id: 'recent', label: 'Recent', type: 'recent' },
    ...savedPacks
      .filter((pack) => pack.stickers.length > 0)
      .map((pack) => ({
        id: `pack:${pack.id}`,
        label: pack.name,
        sticker: pack.stickers[0],
        type: 'pack' as const,
      })),
  ];
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
        pack.stickers.map((sticker) => sticker.assetCid),
      ),
      ...publicPacks.flatMap((pack) =>
        pack.stickers.map((sticker) => sticker.assetCid),
      ),
    ];

    assetCids.slice(0, 80).forEach(preloadStickerAsset);
  }, [favoriteItems, publicPacks, recentItems, savedPacks]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-45"
        aria-label="Open stickers"
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
        <div className="absolute bottom-full left-0 z-40 mb-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#17171d] text-white shadow-2xl shadow-black/40">
          <div className="flex items-center gap-1 border-b border-white/10 bg-white/5 p-2">
            <PickerTab
              active={tab === 'stickers'}
              label="Stickers"
              onClick={() => setTab('stickers')}
            />
            <PickerTab
              active={tab === 'emoji'}
              label="Emoji"
              onClick={() => setTab('emoji')}
            />
            {tab === 'stickers' && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="ml-auto rounded-xl px-3 py-2 text-xs font-black text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Manage
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
              <div className="mb-3 flex gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;

                    event.preventDefault();
                    void searchPacks();
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/35"
                  placeholder="Search stickers"
                />
                <button
                  type="button"
                  onClick={() => void searchPacks()}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                >
                  Search
                </button>
              </div>
              {error && (
                <div className="mb-3 rounded-xl border border-rose-300/25 bg-rose-500/15 p-2 text-xs text-rose-100">
                  {error}
                </div>
              )}
              {loading && (
                <div className="p-4 text-center text-sm text-white/45">
                  Loading...
                </div>
              )}
              <StickerSection
                favoriteIds={favoriteIds}
                items={favoriteItems}
                label="Favorites"
                onFavoriteToggle={toggleFavorite}
                onSend={sendSticker}
                sectionRef={setStickerSectionRef('favorites')}
                emptyText="No favorite stickers yet."
              />
              <StickerSection
                favoriteIds={favoriteIds}
                items={recentItems}
                label="Recent"
                onFavoriteToggle={toggleFavorite}
                onSend={sendSticker}
                sectionRef={setStickerSectionRef('recent')}
                emptyText="Recently used stickers will appear here."
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
                  emptyText="This pack has no stickers yet."
                />
              ))}
              {!loading &&
                savedPacks.length === 0 &&
                explorePacks.length === 0 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/45">
                    No sticker packs yet. Open Manage to create or save one.
                  </div>
                )}
              {explorePacks.length > 0 && (
                <div className="mt-4 grid gap-2">
                  <div className="text-center text-xs font-black uppercase tracking-[0.16em] text-white/35">
                    Explore
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
            <StickerEmojiPanel
              emojiQuery={emojiQuery}
              emojis={emojis}
              onEmojiInsert={(emoji) => {
                onEmojiInsert(emoji);
                setOpen(false);
              }}
              onQueryChange={setEmojiQuery}
            />
          )}
        </div>
      )}
      {manageOpen &&
        createPortal(
          <StickerManagerDialog
            favoriteIds={favoriteIds}
            favoriteItems={favoriteItems}
            library={library}
            onClose={() => setManageOpen(false)}
            onCreatePack={async (input) => {
              await pigeonApplication.createStickerPack(session, input);
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
          />,
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
