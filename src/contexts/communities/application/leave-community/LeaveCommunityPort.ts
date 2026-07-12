import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface LeaveCommunityPort {
  leaveCommunity(session: Session, communityId: string): Promise<Community>;
}
