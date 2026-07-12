import type {
  Session,
  StickerInput,
  StickerResource,
} from '../../../../shared/domain/pigeonResources.types';

export interface AddStickerToPackPort {
  addStickerToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource>;
}
