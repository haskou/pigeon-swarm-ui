import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { UnfavoriteStickerMessage } from './messages/UnfavoriteStickerMessage';

export class StickerUnfavoriter {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
  ) {}

  public async unfavorite(
    message: UnfavoriteStickerMessage,
  ): Promise<StickerLibrary> {
    const ownerId = message.getOwnerId();
    const library = await this.stickerLibraryRepository.find(ownerId);

    library.unfavorite(
      message.getPackId(),
      message.getStickerId(),
      message.getOccurredAt(),
    );

    return await this.stickerLibraryRepository.save(library, ownerId);
  }
}
