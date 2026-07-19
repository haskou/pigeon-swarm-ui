import type { StickerPackRepository } from '../../domain/repositories/StickerPackRepository';

import { Sticker } from '../../domain/entities/Sticker';
import { StickerDefinition } from '../../domain/value-objects/StickerDefinition';
import { AddStickerToPackMessage } from './messages/AddStickerToPackMessage';

export class StickerAdder {
  public constructor(
    private readonly stickerPackRepository: StickerPackRepository,
  ) {}

  public async add(message: AddStickerToPackMessage): Promise<Sticker> {
    const actorId = message.getActorId();
    const pack = await this.stickerPackRepository.find(message.getPackId());

    const sticker = Sticker.create(
      StickerDefinition.create(
        message.getAssetExternalIdentifier(),
        message.getContentType(),
        message.getDimensions(),
        message.getSize(),
        message.getType(),
      ),
      message.getOccurredAt(),
    );
    pack.add(sticker, message.getOccurredAt());

    return await this.stickerPackRepository.add(pack, actorId);
  }
}
