import type {
  Community,
  CommunityPermission,
  CommunityRoleResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ManageCommunityRolesPort {
  listCommunityRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]>;
  createCommunityRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource>;
  updateCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource>;
  deleteCommunityRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void>;
  assignCommunityMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community>;
}
