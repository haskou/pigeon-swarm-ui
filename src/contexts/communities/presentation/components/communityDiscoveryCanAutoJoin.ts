import type { CommunityDiscoveryResource } from '../../application/resources/CommunityDiscoveryResource';

export function communityDiscoveryCanAutoJoin(
  community: CommunityDiscoveryResource,
): boolean {
  return community.visibility === 'public' && community.autoJoinEnabled === true;
}
