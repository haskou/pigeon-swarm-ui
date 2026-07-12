import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface DeleteStickerPort {
  deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
}
