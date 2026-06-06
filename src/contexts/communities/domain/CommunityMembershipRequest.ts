import type { CommunityMembershipRequestStatus } from './CommunityMembershipRequestStatus';
import type { CommunityMembershipRequestType } from './CommunityMembershipRequestType';

export type CommunityMembershipRequest = {
  communityId: string;
  createdAt: number | string;
  creatorIdentityId: string;
  id: string;
  identityId: string;
  status: CommunityMembershipRequestStatus;
  type: CommunityMembershipRequestType;
  updatedAt: number | string;
};
