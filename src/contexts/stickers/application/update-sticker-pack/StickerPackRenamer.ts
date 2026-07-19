import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { UpdateStickerPackMessage } from './messages/UpdateStickerPackMessage';

export class StickerPackRenamer {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async rename(message: UpdateStickerPackMessage): Promise<StickerPack> {
    const actorId = message.getActorId();
    const pack = await this.stickerPackRepository.find(message.getPackId());

    pack.rename(message.getName(), message.getOccurredAt());

    return await this.stickerPackRepository.save(pack, actorId);
  }
}
