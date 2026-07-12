import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface FavoriteStickerPort {
  favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
}
