import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { MarkStickerUsedMessage } from './messages/MarkStickerUsedMessage';

export class StickerUsageMarker {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async mark(message: MarkStickerUsedMessage): Promise<StickerLibrary> {
    const ownerId = message.getOwnerId();
    const [library, pack] = await Promise.all([
      this.stickerLibraryRepository.find(ownerId),
      this.stickerPackRepository.find(message.getPackId()),
    ]);

    library.markUsed(pack, message.getStickerId(), message.getOccurredAt());

    return await this.stickerLibraryRepository.save(library, ownerId);
  }
}
