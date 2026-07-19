import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { DeleteStickerMessage } from './messages/DeleteStickerMessage';

export class StickerRemover {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async remove(message: DeleteStickerMessage): Promise<StickerPack> {
    const actorId = message.getActorId();
    const pack = await this.stickerPackRepository.find(message.getPackId());

    pack.remove(message.getStickerId(), message.getOccurredAt());

    return await this.stickerPackRepository.save(pack, actorId);
  }
}
