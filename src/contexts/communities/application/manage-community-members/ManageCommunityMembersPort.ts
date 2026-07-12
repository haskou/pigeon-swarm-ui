import type {
  Community,
  CommunityMembershipRequest,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityMembersPort {
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
  listCommunityMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]>;
}
