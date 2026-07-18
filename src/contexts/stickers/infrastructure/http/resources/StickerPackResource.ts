import type { StickerResource } from './StickerResource';

export type StickerPackResource = {
  createdAt?: number;
  id: string;
  name: string;
  ownerIdentityId: string;
  stickers: StickerResource[];
  updatedAt?: number;
};
