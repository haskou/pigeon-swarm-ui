import type {
  PublicFileUpload,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface UploadPublicFilePort {
  uploadPublicFile(session: Session, file: File): Promise<PublicFileUpload>;
}
