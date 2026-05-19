import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type {
  MyStickersResource,
  PublicFileUpload,
  Session,
  StickerDimensions,
  StickerInput,
  StickerMessageReference,
  StickerPackResource,
  StickerResource,
  StickerType,
  StickerUsageResource,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { cx } from '../../utils/classNameHelper';
import {
  type EmojiSuggestion,
  searchEmojiSuggestions,
} from '../../utils/emojiShortcodes';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

type StickerPickerProps = {
  disabled: boolean;
  onEmojiInsert: (emoji: string) => void;
  onStickerSend: (sticker: StickerMessageReference) => Promise<void>;
  session: Session;
};

type StickerGridItem = {
  packId: string;
  sticker: StickerResource;
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
  const pickerRef = useRef<HTMLDivElement>(null);
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
      setLibrary(await pigeonApplication.getMyStickers(session));
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

      if (
        target instanceof Node &&
        pickerRef.current?.contains(target)
      ) {
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
      const packs = await pigeonApplication.listStickerPacks();
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
    await loadLibrary();
  };

  const deleteSticker = async (packId: string, stickerId: string) => {
    await pigeonApplication.deleteSticker(session, packId, stickerId);
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
    await loadLibrary();
  };

  const recentItems = usageItems(library?.recentStickers ?? []);
  const favoriteItems = usageItems(library?.favoriteStickers ?? []);
  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg text-white/75 transition hover:bg-white/15 disabled:cursor-not-allowed"
        aria-label="Open stickers"
      >
        ☺
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
            <div className="max-h-[24rem] overflow-y-auto p-3">
              <form
                className="mb-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchPacks();
                }}
              >
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/35"
                  placeholder="Search stickers"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                >
                  Search
                </button>
              </form>
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
              />
              <StickerSection
                favoriteIds={favoriteIds}
                items={recentItems}
                label="Recent"
                onFavoriteToggle={toggleFavorite}
                onSend={sendSticker}
              />
              {(library?.savedPacks ?? []).map((pack) => (
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
                />
              ))}
              {publicPacks.length > 0 && (
                <div className="mt-4 grid gap-2">
                  <div className="text-center text-xs font-black uppercase tracking-[0.16em] text-white/35">
                    Explore
                  </div>
                  {publicPacks.map((pack) => {
                    const saved = savedPackIds.has(pack.id);

                    return (
                      <div
                        key={pack.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black">
                              {pack.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void savePack(pack.id, saved)}
                            className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-white/70 transition hover:bg-white/15"
                          >
                            {saved ? 'Remove' : 'Save'}
                          </button>
                        </div>
                        <StickerGrid
                          favoriteIds={favoriteIds}
                          items={pack.stickers.map((sticker) => ({
                            packId: pack.id,
                            sticker,
                          }))}
                          onFavoriteToggle={toggleFavorite}
                          onSend={sendSticker}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto p-3">
              <input
                value={emojiQuery}
                onChange={(event) => setEmojiQuery(event.target.value)}
                className="mb-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/35"
                placeholder="Search emojis"
              />
              <div className="grid grid-cols-7 gap-1">
                {emojis.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.shortcode}
                    onClick={() => {
                      onEmojiInsert(suggestion.emoji);
                      setOpen(false);
                    }}
                    className="grid aspect-square place-items-center rounded-xl text-2xl transition hover:bg-white/10"
                    title={suggestion.shortcode}
                  >
                    {suggestion.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {manageOpen &&
        createPortal(
          <StickerManagerDialog
            favoriteIds={favoriteIds}
            library={library}
            onClose={() => setManageOpen(false)}
            onCreatePack={async (input) => {
              await pigeonApplication.createStickerPack(session, input);
              await loadLibrary();
            }}
            onFavoriteToggle={toggleFavorite}
            onRefresh={loadLibrary}
            onSavePack={savePack}
            onStickerDelete={deleteSticker}
            onStickerCreated={loadLibrary}
            publicPacks={publicPacks}
            savedPackIds={savedPackIds}
            session={session}
          />,
          document.body,
        )}
    </div>
  );
}

export function stickerAssetUrl(assetCid: string): string {
  return pigeonApplication.stickerAssetUrl(assetCid);
}

export function StickerPackPreviewDialog({
  onClose,
  session,
  sticker,
}: {
  onClose: () => void;
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
        pigeonApplication.getStickerPack(sticker.packId),
        pigeonApplication.getMyStickers(session),
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
            ×
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
            <div className="mb-4 flex justify-center rounded-2xl bg-white/5 p-4">
              <img
                src={stickerAssetUrl(sticker.assetCid)}
                alt=""
                className="max-h-48 max-w-full object-contain"
              />
            </div>
            {pack && pack.stickers.length > 0 && (
              <div className="mb-4 grid grid-cols-5 gap-2 sm:grid-cols-6">
                {pack.stickers.map((packSticker) => (
                  <img
                    key={packSticker.id}
                    src={stickerAssetUrl(packSticker.assetCid)}
                    alt="Sticker"
                    className="aspect-square rounded-xl bg-black/20 object-contain p-1"
                  />
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

function PickerTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl px-3 py-2 text-xs font-black transition',
        active ? 'bg-white text-slate-950' : 'text-white/55 hover:bg-white/10',
      )}
    >
      {label}
    </button>
  );
}

function StickerSection({
  favoriteIds,
  items,
  label,
  onFavoriteToggle,
  onSend,
}: {
  favoriteIds: Set<string>;
  items: StickerGridItem[];
  label: string;
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onSend: (packId: string, sticker: StickerResource) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <StickerGrid
        favoriteIds={favoriteIds}
        items={items}
        onFavoriteToggle={onFavoriteToggle}
        onSend={onSend}
      />
    </div>
  );
}

function StickerGrid({
  favoriteIds,
  items,
  onFavoriteToggle,
  onSend,
}: {
  favoriteIds: Set<string>;
  items: StickerGridItem[];
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onSend: (packId: string, sticker: StickerResource) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(({ packId, sticker }) => {
        const favorite = favoriteIds.has(`${packId}:${sticker.id}`);

        return (
          <div key={`${packId}:${sticker.id}`} className="group relative">
            <button
              type="button"
              onClick={() => void onSend(packId, sticker)}
              title="Sticker"
              className="grid aspect-square w-full place-items-center rounded-xl bg-white/5 p-1 transition hover:bg-white/10"
            >
              <img
                src={stickerAssetUrl(sticker.assetCid)}
                alt="Sticker"
                className="max-h-full max-w-full object-contain"
              />
            </button>
            <button
              type="button"
              onClick={() => void onFavoriteToggle(packId, sticker.id, favorite)}
              className={cx(
                'absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-xs shadow opacity-0 transition group-hover:opacity-100',
                favorite
                  ? 'bg-fuchsia-400 text-white'
                  : 'bg-black/70 text-white/70 hover:text-white',
              )}
              aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
            >
              ♥
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StickerManagerDialog({
  favoriteIds,
  library,
  onClose,
  onCreatePack,
  onFavoriteToggle,
  onRefresh,
  onSavePack,
  onStickerDelete,
  onStickerCreated,
  publicPacks,
  savedPackIds,
  session,
}: {
  favoriteIds: Set<string>;
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
  publicPacks: StickerPackResource[];
  savedPackIds: Set<string>;
  session: Session;
}) {
  const [packName, setPackName] = useState('');
  const [mode, setMode] = useState<'create' | 'mine' | 'saved'>('mine');
  const [packSearch, setPackSearch] = useState('');
  const [packSearchResults, setPackSearchResults] =
    useState<StickerPackResource[]>(publicPacks);
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
    setPackSearchResults(publicPacks);
  }, [publicPacks]);

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

  const searchPacks = async (event: FormEvent) => {
    event.preventDefault();
    setSearchingPacks(true);
    setError(null);
    try {
      const packs = await pigeonApplication.listStickerPacks();
      const normalizedQuery = packSearch.trim().toLowerCase();

      setPackSearchResults(
        normalizedQuery
          ? packs.filter((pack) =>
              pack.name.toLowerCase().includes(normalizedQuery),
            )
          : packs,
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'Sticker packs could not be found.'));
    } finally {
      setSearchingPacks(false);
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
          <button
            type="button"
            onClick={() => setMode('saved')}
            className={cx(
              'rounded-xl px-3 py-2 text-sm font-black transition',
              mode === 'saved'
                ? 'bg-white text-slate-950'
                : 'text-white/55 hover:bg-white/10',
            )}
          >
            Saved packs
          </button>
          <button
            type="button"
            onClick={() => setMode('mine')}
            className={cx(
              'rounded-xl px-3 py-2 text-sm font-black transition',
              mode === 'mine'
                ? 'bg-white text-slate-950'
                : 'text-white/55 hover:bg-white/10',
            )}
          >
            My packs
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={cx(
              'rounded-xl px-3 py-2 text-sm font-black transition',
              mode === 'create'
                ? 'bg-white text-slate-950'
                : 'text-white/55 hover:bg-white/10',
            )}
          >
            Create pack
          </button>
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
          <>
            {ownPacks.length > 0 && (
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
            )}
            {ownPacks.length === 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
                Create a pack first to upload stickers.
              </div>
            )}
          </>
        ) : (
          <>
            <form
              onSubmit={searchPacks}
              className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]"
            >
              <input
                value={packSearch}
                onChange={(event) => setPackSearch(event.target.value)}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none"
                placeholder="Search sticker packs"
              />
              <button
                type="submit"
                disabled={searchingPacks}
                className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-45"
              >
                Search
              </button>
            </form>
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
                  items={usageItems(library?.favoriteStickers ?? [])}
                  onFavoriteToggle={onFavoriteToggle}
                  onSend={async () => undefined}
                />
              </section>
            </div>
            {packSearchResults.length > 0 && (
              <section className="mt-5">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
                  Search results
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
          </>
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadSticker = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const [upload, dimensions] = await Promise.all([
        pigeonApplication.uploadStickerAsset(session, file),
        readMediaDimensions(file),
      ]);

      await pigeonApplication.addStickerToPack(session, pack.id, {
        assetCid: upload.cid,
        contentType: upload.contentType,
        dimensions,
        sizeBytes: upload.size,
        type: stickerTypeFromUpload(upload),
      });
      await onStickerCreated();
    } catch (caught) {
      setError(toUserErrorMessage(caught, 'Sticker could not be uploaded.'));
    } finally {
      setUploading(false);
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
              ...
            </span>
          ) : (
            '+'
          )}
          <input
            type="file"
            accept="image/*,video/*"
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

function usageItems(items: StickerUsageResource[]): StickerGridItem[] {
  return items.map((item) => ({
    packId: item.packId,
    sticker: item.sticker,
  }));
}

function stickerTypeFromUpload(upload: PublicFileUpload): StickerType {
  if (upload.contentType.startsWith('video/')) return 'video';
  if (upload.contentType === 'image/gif') return 'animated';

  return 'static';
}

async function readMediaDimensions(file: File): Promise<StickerDimensions> {
  if (file.type.startsWith('video/')) return await readVideoDimensions(file);

  return await readImageDimensions(file);
}

function readImageDimensions(file: File): Promise<StickerDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image dimensions could not be read.'));
    };
    image.src = url;
  });
}

function readVideoDimensions(file: File): Promise<StickerDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        height: video.videoHeight,
        width: video.videoWidth,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Video dimensions could not be read.'));
    };
    video.src = url;
  });
}
