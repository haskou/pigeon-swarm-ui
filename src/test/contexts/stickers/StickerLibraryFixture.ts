import { StickerLibrary } from '../../../contexts/stickers/domain/StickerLibrary';
import { stickerPackPrimitives, stickerPrimitives } from './StickerPackFixture';

export const stickerLibraryFixture = (): StickerLibrary =>
  StickerLibrary.fromPrimitives({
    favoriteStickers: [],
    ownerIdentityId: 'identity-a',
    recentStickers: [],
    savedPacks: [],
  });

export const populatedStickerLibraryFixture = (): StickerLibrary =>
  StickerLibrary.fromPrimitives({
    favoriteStickers: [
      {
        favoritedAt: 100,
        packId: 'pack-a',
        sticker: stickerPrimitives(),
        stickerId: 'sticker-a',
        usedAt: undefined,
      },
    ],
    ownerIdentityId: 'identity-a',
    recentStickers: [],
    savedPacks: [stickerPackPrimitives()],
  });
