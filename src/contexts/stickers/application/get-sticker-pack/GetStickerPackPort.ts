import type { StickerPackResource } from '../../../../shared/domain/pigeonResources.types';

export interface GetStickerPackPort {
  getStickerPack(packId: string): Promise<StickerPackResource>;
}
