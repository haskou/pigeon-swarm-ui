import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';
import type { ListStickerPacksMessage } from './messages/ListStickerPacksMessage';

export interface ListStickerPacksPort {
  list(message: ListStickerPacksMessage): Promise<StickerPackResource[]>;
}
