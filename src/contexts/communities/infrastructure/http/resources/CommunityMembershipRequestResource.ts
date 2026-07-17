import type { PrimitiveOf } from '@haskou/value-objects';

import type { CommunityMembershipRequestStatus } from '../../../domain/value-objects/CommunityMembershipRequestStatus';
import type { CommunityMembershipRequestType } from '../../../domain/value-objects/CommunityMembershipRequestType';

export type CommunityMembershipRequestResource = {
  communityId: string;
  createdAt: number | string;
  creatorIdentityId: string;
  id: string;
  identityId: string;
  status: PrimitiveOf<CommunityMembershipRequestStatus>;
  type: PrimitiveOf<CommunityMembershipRequestType>;
  updatedAt: number | string;
};
