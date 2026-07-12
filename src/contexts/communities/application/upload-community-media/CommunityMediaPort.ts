import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface CommunityMediaPort {
  uploadPublicFile(session: Session, file: File): Promise<{ cid: string }>;
}
