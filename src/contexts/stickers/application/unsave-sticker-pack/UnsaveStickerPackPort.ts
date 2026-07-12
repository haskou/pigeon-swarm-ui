import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface UnsaveStickerPackPort {
  unsaveStickerPack(session: Session, packId: string): Promise<void>;
}
