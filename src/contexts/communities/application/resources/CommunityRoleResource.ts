import type { CommunityPermissionPrimitive } from './CommunityPermissionPrimitive';

export type CommunityRoleResource = {
  builtIn?: boolean;
  id: string;
  name: string;
  permissions: CommunityPermissionPrimitive[];
};
