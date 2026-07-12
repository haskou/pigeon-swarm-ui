import type {
  Session,
  StickerInput,
  StickerResource,
} from '../../../../shared/domain/pigeonResources.types';

export interface UpdateStickerPort {
  updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource>;
}
