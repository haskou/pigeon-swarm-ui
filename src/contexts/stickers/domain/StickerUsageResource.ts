import type { StickerResource } from './StickerResource';

export type StickerUsageResource = {
  favoritedAt?: number;
  packId: string;
  sticker: StickerResource;
  stickerId: string;
  usedAt?: number;
};
