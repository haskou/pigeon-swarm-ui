import type {
  Community,
  CommunityVisibility,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CreateCommunityPort {
  createCommunity(
    session: Session,
    input: {
      autoJoinEnabled?: boolean;
      avatar?: string;
      banner?: string;
      description: string;
      discoverable?: boolean;
      name: string;
      networkId: string;
      visibility?: CommunityVisibility;
    },
  ): Promise<Community>;
}
