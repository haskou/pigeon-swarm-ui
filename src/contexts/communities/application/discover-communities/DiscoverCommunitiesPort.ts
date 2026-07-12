import type {
  CommunityDiscoveryResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface DiscoverCommunitiesPort {
  discoverCommunities(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]>;
}
