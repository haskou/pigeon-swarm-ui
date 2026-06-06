import type { StickerPackResource, StickerResource } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { StickerGrid } from './stickerPickerParts';

export function StickerExplorePack({
  favoriteIds,
  onFavoriteToggle,
  onSavePack,
  onSend,
  pack,
  saved,
}: {
  favoriteIds: Set<string>;
  onFavoriteToggle: (
    packId: string,
    stickerId: string,
    favorite: boolean,
  ) => Promise<void>;
  onSavePack: (packId: string, saved: boolean) => Promise<void>;
  onSend: (packId: string, sticker: StickerResource) => Promise<void>;
  pack: StickerPackResource;
  saved: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{pack.name}</div>
        </div>
        <button
          type="button"
          onClick={() => void onSavePack(pack.id, saved)}
          className="rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-white/70 transition hover:bg-white/15"
        >
          {saved ? copy.stickers.removePack : copy.stickers.savePack}
        </button>
      </div>
      <StickerGrid
        favoriteIds={favoriteIds}
        items={pack.stickers.map((sticker) => ({
          packId: pack.id,
          sticker,
        }))}
        onFavoriteToggle={onFavoriteToggle}
        onSend={onSend}
      />
    </div>
  );
}
