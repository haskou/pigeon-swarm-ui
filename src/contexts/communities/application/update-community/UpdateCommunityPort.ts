import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface UpdateCommunityPort {
  updateCommunity(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean;
      avatar?: string;
      banner?: string;
      description?: string;
      discoverable?: boolean;
      name?: string;
    },
  ): Promise<Community>;
}
