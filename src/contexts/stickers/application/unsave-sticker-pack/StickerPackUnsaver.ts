import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { UnsaveStickerPackMessage } from './messages/UnsaveStickerPackMessage';

export class StickerPackUnsaver {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
  ) {}

  public async unsave(
    message: UnsaveStickerPackMessage,
  ): Promise<StickerLibrary> {
    const ownerId = message.getOwnerId();
    const library = await this.stickerLibraryRepository.find(ownerId);

    library.unsave(message.getPackId(), message.getOccurredAt());

    return await this.stickerLibraryRepository.save(library, ownerId);
  }
}
