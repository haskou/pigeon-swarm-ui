import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { StickerPack as StickerPackAggregate } from '../../domain/StickerPack';
import { CreateStickerPackMessage } from './messages/CreateStickerPackMessage';

export class StickerPackCreator {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async create(message: CreateStickerPackMessage): Promise<StickerPack> {
    const actorId = message.getActorId();
    const pack = StickerPackAggregate.create(
      actorId,
      message.getName(),
      message.getOccurredAt(),
    );

    return await this.stickerPackRepository.create(pack, actorId);
  }
}
