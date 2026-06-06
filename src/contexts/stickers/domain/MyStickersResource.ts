import type { StickerPackResource } from './StickerPackResource';
import type { StickerUsageResource } from './StickerUsageResource';

export type MyStickersResource = {
  favoriteStickers: StickerUsageResource[];
  recentStickers: StickerUsageResource[];
  savedPacks: StickerPackResource[];
};
