import type { StickerLibraryRepository } from '../../domain/repositories/StickerLibraryRepository';
import type { StickerLibrary } from '../../domain/StickerLibrary';

import { GetMyStickersMessage } from './messages/GetMyStickersMessage';

export class StickerLibraryFinder {
  public constructor(
    private readonly stickerLibraryRepository: StickerLibraryRepository,
  ) {}

  public async find(message: GetMyStickersMessage): Promise<StickerLibrary> {
    return await this.stickerLibraryRepository.find(message.getOwnerId());
  }
}
