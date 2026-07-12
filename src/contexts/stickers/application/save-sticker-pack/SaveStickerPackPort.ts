import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface SaveStickerPackPort {
  saveStickerPack(session: Session, packId: string): Promise<void>;
}
