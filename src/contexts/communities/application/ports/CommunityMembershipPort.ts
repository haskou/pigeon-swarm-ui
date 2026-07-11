import type {
  Community,
  CommunityMembershipRequest,
  CommunityMembershipRequestStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface CommunityMembershipPort {
  addCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest>;
  banCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community>;
  unbanCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community>;
  kickCommunityMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community>;
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
  leaveCommunity(session: Session, communityId: string): Promise<Community>;
  listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]>;
}
