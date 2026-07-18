import type { PrimitiveOf } from '@haskou/value-objects';

import type { Sticker } from '../../../contexts/stickers/domain/entities/Sticker';

import { StickerPack } from '../../../contexts/stickers/domain/StickerPack';

export const stickerPrimitives = (id = 'sticker-a'): PrimitiveOf<Sticker> => ({
  createdAt: 100,
  definition: {
    assetExternalIdentifier: `asset-${id}`,
    contentType: 'image/webp',
    dimensions: { height: 128, width: 128 },
    sizeBytes: 512,
    type: 'static',
  },
  id,
  updatedAt: 100,
});

export const stickerPackPrimitives = (
  overrides: Partial<PrimitiveOf<StickerPack>> = {},
): PrimitiveOf<StickerPack> => ({
  createdAt: 100,
  id: 'pack-a',
  name: 'Daily',
  ownerIdentityId: 'identity-a',
  stickers: [stickerPrimitives()],
  updatedAt: 100,
  ...overrides,
});

export const stickerPackFixture = (
  overrides: Partial<PrimitiveOf<StickerPack>> = {},
): StickerPack => StickerPack.fromPrimitives(stickerPackPrimitives(overrides));
