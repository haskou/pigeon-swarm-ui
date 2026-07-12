import type {
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface UploadStickerAssetPort {
  uploadStickerAsset(session: Session, file: File): Promise<PublicFileUpload>;
}
