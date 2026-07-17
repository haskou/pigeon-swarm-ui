import type {
  AttachmentProgress,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type AttachmentPublicationContext = {
  file: File;
  onProgress?: (progress: AttachmentProgress) => void;
  session: Session;
};
