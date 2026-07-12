import type {
  CommunityMembershipRequest,
  CommunityMembershipRequestStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityMembershipRequestsPort {
  createCommunityJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest>;
  listCommunityMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]>;
  updateCommunityMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<CommunityMembershipRequestStatus, 'accepted' | 'declined'>,
  ): Promise<CommunityMembershipRequest>;
}
