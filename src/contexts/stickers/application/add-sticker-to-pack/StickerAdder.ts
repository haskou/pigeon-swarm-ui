import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { Sticker } from '../../domain/entities/Sticker';
import { StickerDefinition } from '../../domain/StickerDefinition';
import { AddStickerToPackMessage } from './messages/AddStickerToPackMessage';

export class StickerAdder {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async add(message: AddStickerToPackMessage): Promise<StickerPack> {
    const actorId = message.getActorId();
    const pack = await this.stickerPackRepository.find(message.getPackId());

    pack.add(
      Sticker.create(
        StickerDefinition.create(
          message.getAssetExternalIdentifier(),
          message.getContentType(),
          message.getDimensions(),
          message.getSize(),
          message.getType(),
        ),
        message.getOccurredAt(),
      ),
      message.getOccurredAt(),
    );

    return await this.stickerPackRepository.save(pack, actorId);
  }
}
