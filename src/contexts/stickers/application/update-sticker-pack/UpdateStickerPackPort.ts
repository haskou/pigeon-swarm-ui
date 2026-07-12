import type {
  Session,
  StickerPackInput,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

export interface UpdateStickerPackPort {
  updateStickerPack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource>;
}
