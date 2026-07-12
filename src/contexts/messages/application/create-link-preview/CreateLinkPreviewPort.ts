import type {
  MessageLinkPreview,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateLinkPreviewPort {
  createLinkPreview(session: Session, url: string): Promise<MessageLinkPreview>;
}
