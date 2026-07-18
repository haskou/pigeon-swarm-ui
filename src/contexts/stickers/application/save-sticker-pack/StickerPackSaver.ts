import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { SaveStickerPackMessage } from './messages/SaveStickerPackMessage';

export class StickerPackSaver {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async save(message: SaveStickerPackMessage): Promise<StickerLibrary> {
    const ownerId = message.getOwnerId();
    const [library, pack] = await Promise.all([
      this.stickerLibraryRepository.find(ownerId),
      this.stickerPackRepository.find(message.getPackId()),
    ]);

    library.save(pack, message.getOccurredAt());

    return await this.stickerLibraryRepository.save(library, ownerId);
  }
}
