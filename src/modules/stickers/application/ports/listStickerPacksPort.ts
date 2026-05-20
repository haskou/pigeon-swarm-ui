import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksMessage } from '../list-sticker-packs/messages/listStickerPacksMessage';

export interface ListStickerPacksPort {
  list(message: ListStickerPacksMessage): Promise<StickerPackResource[]>;
}
