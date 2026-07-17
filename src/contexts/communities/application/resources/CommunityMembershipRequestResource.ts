import type { CommunityMembershipRequestStatus } from '../../domain/CommunityMembershipRequestStatus';
import type { CommunityMembershipRequestType } from '../../domain/CommunityMembershipRequestType';

export type CommunityMembershipRequestResource = {
  communityId: string;
  createdAt: number | string;
  creatorIdentityId: string;
  id: string;
  identityId: string;
  status: CommunityMembershipRequestStatus;
  type: CommunityMembershipRequestType;
  updatedAt: number | string;
};
