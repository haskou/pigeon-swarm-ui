import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';
import type { StickerPack } from '../../domain/StickerPack';

import { Sticker } from '../../domain/entities/Sticker';
import { StickerDefinition } from '../../domain/value-objects/StickerDefinition';
import { UpdateStickerMessage } from './messages/UpdateStickerMessage';

export class StickerUpdater {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async update(message: UpdateStickerMessage): Promise<StickerPack> {
    const actorId = message.getActorId();
    const pack = await this.stickerPackRepository.find(message.getPackId());

    pack.replace(
      Sticker.update(
        message.getStickerId(),
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
