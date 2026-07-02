import type { CommunityDiscoveryResource } from '../../domain/CommunityDiscoveryResource';

export function communityDiscoveryCanAutoJoin(
  community: CommunityDiscoveryResource,
): boolean {
  return community.visibility === 'public' && community.autoJoinEnabled === true;
}
