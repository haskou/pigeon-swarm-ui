import type { CommunityMembershipRequest } from './CommunityMembershipRequest';
import type { CommunityVisibility } from './CommunityVisibility';

export type CommunityDiscoveryResource = {
  autoJoinEnabled?: boolean;
  avatar?: string | null;
  banner?: string | null;
  description: string;
  discoverable?: boolean;
  id: string;
  memberCount: number;
  membershipRequest?: CommunityMembershipRequest;
  membershipStatus: 'invited' | 'member' | 'none' | 'requested';
  name: string;
  networkId: string;
  ownerIdentityId: string;
  visibility: CommunityVisibility;
};
