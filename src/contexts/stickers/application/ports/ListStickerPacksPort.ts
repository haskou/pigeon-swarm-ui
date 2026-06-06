import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksMessage } from '../list-sticker-packs/messages/ListStickerPacksMessage';

export interface ListStickerPacksPort {
  list(message: ListStickerPacksMessage): Promise<StickerPackResource[]>;
}
