import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { ListStickerPacksMessage } from './messages/ListStickerPacksMessage';

export class ListStickerPacks {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async list(message: ListStickerPacksMessage): Promise<StickerPack[]> {
    return await this.stickerPackRepository.search(message.getOwnerId());
  }
}
