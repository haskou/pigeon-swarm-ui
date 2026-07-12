import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface UnfavoriteStickerPort {
  unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
}
