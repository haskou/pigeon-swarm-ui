import type { StickerDimensions } from './StickerDimensions';
import type { StickerType } from './StickerType';

export type StickerInput = {
  assetCid: string;
  contentType: string;
  dimensions: StickerDimensions;
  sizeBytes: number;
  type: StickerType;
};
