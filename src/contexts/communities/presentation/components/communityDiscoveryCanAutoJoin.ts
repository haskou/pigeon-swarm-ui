import type { CommunityDiscoveryResource } from '../../infrastructure/http/resources/CommunityDiscoveryResource';

export function communityDiscoveryCanAutoJoin(
  community: CommunityDiscoveryResource,
): boolean {
  return (
    community.visibility === 'public' && community.autoJoinEnabled === true
  );
}
