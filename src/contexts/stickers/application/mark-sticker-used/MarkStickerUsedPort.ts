import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface MarkStickerUsedPort {
  markStickerUsed(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
}
