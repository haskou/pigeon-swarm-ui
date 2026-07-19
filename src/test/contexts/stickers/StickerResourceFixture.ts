import type {
  MyStickersResource,
  StickerPackResource,
  StickerResource,
} from '../../../shared/domain/pigeonResources.types';

export const stickerResource = (id = 'sticker-a'): StickerResource => ({
  assetCid: `asset-${id}`,
  contentType: 'image/webp',
  createdAt: 100,
  dimensions: { height: 128, width: 128 },
  id,
  sizeBytes: 512,
  type: 'static',
  updatedAt: 100,
});

export const stickerPackResource = (): StickerPackResource => ({
  createdAt: 100,
  id: 'pack-a',
  name: 'Daily',
  ownerIdentityId: 'identity-a',
  stickers: [stickerResource()],
  updatedAt: 100,
});

export const stickerLibraryResource = (): MyStickersResource => ({
  favoriteStickers: [],
  recentStickers: [],
  savedPacks: [],
});
