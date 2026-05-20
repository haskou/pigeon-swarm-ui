import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksPort } from '../ports/listStickerPacksPort';

import { ListStickerPacksMessage } from './messages/listStickerPacksMessage';

export class ListStickerPacks {
  public constructor(private readonly stickers: ListStickerPacksPort) {}

  public async list(
    message: ListStickerPacksMessage,
  ): Promise<StickerPackResource[]> {
    return await this.stickers.list(message);
  }
}
