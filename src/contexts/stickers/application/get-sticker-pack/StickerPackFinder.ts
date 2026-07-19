import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { GetStickerPackMessage } from './messages/GetStickerPackMessage';

export class StickerPackFinder {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async find(message: GetStickerPackMessage): Promise<StickerPack> {
    return await this.stickerPackRepository.find(message.getPackId());
  }
}
