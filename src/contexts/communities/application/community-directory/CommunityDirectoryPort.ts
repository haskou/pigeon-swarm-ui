import type {
  Community,
  CommunityDiscoveryResource,
  CommunityModerationLogPage,
  CommunityVisibility,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CommunityDirectoryPort {
  listCommunities(session: Session): Promise<Community[]>;
  getCommunity(session: Session, communityId: string): Promise<Community>;
  listCommunityModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage>;
  discoverCommunities(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]>;
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
