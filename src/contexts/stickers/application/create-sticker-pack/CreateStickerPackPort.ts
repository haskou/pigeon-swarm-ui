import type {
  Session,
  StickerPackInput,
  StickerPackResource,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateStickerPackPort {
  createStickerPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource>;
}
