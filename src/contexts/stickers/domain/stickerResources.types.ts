export type StickerType = 'animated' | 'static' | 'video';

export type StickerDimensions = {
  height: number;
  width: number;
};

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

export type StickerPackResource = {
  createdAt?: number;
  id: string;
  name: string;
  ownerIdentityId: string;
  stickers: StickerResource[];
  updatedAt?: number;
};

export type StickerPackInput = {
  name: string;
};

export type StickerInput = {
  assetCid: string;
  contentType: string;
  dimensions: StickerDimensions;
  sizeBytes: number;
  type: StickerType;
};

export type StickerMessageReference = {
  assetCid: string;
  packId: string;
  stickerId: string;
};

export type StickerUsageResource = {
  favoritedAt?: number;
  packId: string;
  sticker: StickerResource;
  stickerId: string;
  usedAt?: number;
};

export type MyStickersResource = {
  favoriteStickers: StickerUsageResource[];
  recentStickers: StickerUsageResource[];
  savedPacks: StickerPackResource[];
};
