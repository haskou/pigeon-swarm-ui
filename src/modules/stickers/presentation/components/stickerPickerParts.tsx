import type { StickerResource } from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';
import { stickerAssetUrl, useStickerPressPreview } from './stickerPressPreview';

export type StickerGridItem = {
  packId: string;
  sticker: StickerResource;
};

export type StickerShortcut = {
  id: string;
  label: string;
  sticker?: StickerResource;
  type: 'favorites' | 'pack' | 'recent';
};

export function PickerTab({
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

export function StickerShortcutBar({
  activeShortcutId,
  onSelect,
  shortcuts,
}: {
  activeShortcutId: string;
  onSelect: (sectionId: string) => void;
  shortcuts: StickerShortcut[];
}) {
  return (
    <div className="sticky -top-3 z-20 -mx-3 -mt-3 mb-3 border-b border-white/10 bg-[#17171d] px-3 pb-2 pt-3 shadow-[0_10px_18px_rgba(23,23,29,0.9)]">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.id}
            type="button"
            onClick={() => onSelect(shortcut.id)}
            className={cx(
              'grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl text-lg transition',
              activeShortcutId === shortcut.id
                ? 'bg-white text-slate-950 shadow shadow-white/10'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
            )}
            aria-label={`Go to ${shortcut.label}`}
            title={shortcut.label}
          >
            {shortcut.sticker ? (
              <img
                src={stickerAssetUrl(shortcut.sticker.assetCid)}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <span aria-hidden="true">
                {shortcut.type === 'favorites' ? '♡' : '◷'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StickerSection({
  emptyText,
  favoriteIds,
  items,
  label,
  onFavoriteToggle,
  onSend,
  sectionRef,
}: {
  emptyText?: string;
  favoriteIds: Set<string>;
  items: StickerGridItem[];
  label: string;
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onSend: (packId: string, sticker: StickerResource) => Promise<void>;
  sectionRef?: (node: HTMLDivElement | null) => void;
}) {
  if (items.length === 0 && !emptyText) return null;

  return (
    <div className="mt-3 scroll-mt-3" ref={sectionRef}>
      <div className="mb-2 text-center text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      {items.length > 0 ? (
        <StickerGrid
          favoriteIds={favoriteIds}
          items={items}
          onFavoriteToggle={onFavoriteToggle}
          onSend={onSend}
        />
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/45">
          {emptyText}
        </div>
      )}
    </div>
  );
}

export function StickerGrid({
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
            <StickerGridButton
              onSend={() => onSend(packId, sticker)}
              sticker={sticker}
            />
            <button
              type="button"
              onClick={() =>
                void onFavoriteToggle(packId, sticker.id, favorite)
              }
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

function StickerGridButton({
  onSend,
  sticker,
}: {
  onSend: () => Promise<void>;
  sticker: StickerResource;
}) {
  const { consumePreviewClick, pressPreviewHandlers, previewPortal } =
    useStickerPressPreview(sticker.assetCid);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (consumePreviewClick()) return;

          void onSend();
        }}
        title="Sticker"
        className="grid aspect-square w-full touch-none select-none place-items-center rounded-xl bg-white/5 p-1 transition hover:bg-white/10"
        {...pressPreviewHandlers}
      >
        <img
          src={stickerAssetUrl(sticker.assetCid)}
          alt="Sticker"
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </button>
      {previewPortal}
    </>
  );
}
