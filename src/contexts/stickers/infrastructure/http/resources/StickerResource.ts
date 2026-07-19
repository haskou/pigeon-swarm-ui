import type { StickerDimensions } from './StickerDimensions';
import type { StickerType } from './StickerType';

export type StickerResource = {
  assetCid: string;
  contentType: string;
  createdAt?: number;
  dimensions?: StickerDimensions;
  id: string;
  sizeBytes?: number;
  type: StickerType;
  updatedAt?: number;
};
