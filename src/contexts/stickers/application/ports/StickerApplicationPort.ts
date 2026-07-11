import type {
  MyStickersResource,
  PublicFileUpload,
  Session,
  StickerInput,
  StickerPackInput,
  StickerPackResource,
  StickerResource,
} from '../../../../shared/domain/pigeonResources.types';

export interface StickerApplicationPort {
  addStickerToPack(
    session: Session,
    packId: string,
    input: StickerInput,
  ): Promise<StickerResource>;
  apiUrl(path: string): string;
  createStickerPack(
    session: Session,
    input: StickerPackInput,
  ): Promise<StickerPackResource>;
  deleteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
  favoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
  getMyStickers(session: Session): Promise<MyStickersResource>;
  getStickerPack(packId: string): Promise<StickerPackResource>;
  listStickerPacks(input: {
    ownerIdentityId?: string;
  }): Promise<StickerPackResource[]>;
  markStickerUsed(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
  saveStickerPack(session: Session, packId: string): Promise<void>;
  unfavoriteSticker(
    session: Session,
    packId: string,
    stickerId: string,
  ): Promise<void>;
  unsaveStickerPack(session: Session, packId: string): Promise<void>;
  updateSticker(
    session: Session,
    packId: string,
    stickerId: string,
    input: StickerInput,
  ): Promise<StickerResource>;
  updateStickerPack(
    session: Session,
    packId: string,
    input: Partial<StickerPackInput>,
  ): Promise<StickerPackResource>;
  uploadStickerAsset(session: Session, file: File): Promise<PublicFileUpload>;
}
