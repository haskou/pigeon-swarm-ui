import type { StickerLibrary } from '../StickerLibrary';
import type { StickerOwnerId } from '../value-objects/StickerOwnerId';

export interface StickerLibraryRepository {
  find(ownerId: StickerOwnerId): Promise<StickerLibrary>;
  save(
    library: StickerLibrary,
    ownerId: StickerOwnerId,
  ): Promise<StickerLibrary>;
}
