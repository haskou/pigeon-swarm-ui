import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { FavoriteStickerMessage } from './messages/FavoriteStickerMessage';

export class StickerFavoriter {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async favorite(
    message: FavoriteStickerMessage,
  ): Promise<StickerLibrary> {
    const ownerId = message.getOwnerId();
    const [library, pack] = await Promise.all([
      this.stickerLibraryRepository.find(ownerId),
      this.stickerPackRepository.find(message.getPackId()),
    ]);

    library.favorite(pack, message.getStickerId(), message.getOccurredAt());

    return await this.stickerLibraryRepository.save(library, ownerId);
  }
}
