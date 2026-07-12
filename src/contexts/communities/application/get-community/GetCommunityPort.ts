import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface GetCommunityPort {
  getCommunity(session: Session, communityId: string): Promise<Community>;
}
