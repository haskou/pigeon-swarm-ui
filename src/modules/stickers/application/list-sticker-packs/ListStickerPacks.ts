import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksPort } from '../ports/ListStickerPacksPort';

import { ListStickerPacksMessage } from './messages/ListStickerPacksMessage';

export class ListStickerPacks {
  public constructor(private readonly stickers: ListStickerPacksPort) {}

  public async list(
    message: ListStickerPacksMessage,
  ): Promise<StickerPackResource[]> {
    return await this.stickers.list(message);
  }
}
