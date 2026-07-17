import type { CommunityMembershipRequestResource } from './CommunityMembershipRequestResource';

export type CommunityDiscoveryResource = {
  autoJoinEnabled?: boolean;
  avatar?: string | null;
  banner?: string | null;
  description: string;
  discoverable?: boolean;
  id: string;
  memberCount: number;
  membershipRequest?: CommunityMembershipRequestResource;
  membershipStatus: 'invited' | 'member' | 'none' | 'requested';
  name: string;
  networkId: string;
  ownerIdentityId: string;
  visibility: 'private' | 'public';
};
