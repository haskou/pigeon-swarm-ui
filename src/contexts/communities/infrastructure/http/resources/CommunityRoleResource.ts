import type { CommunityPermissionResource } from './CommunityPermissionResource';

export type CommunityRoleResource = {
  builtIn?: boolean;
  id: string;
  name: string;
  permissions: CommunityPermissionResource[];
};
