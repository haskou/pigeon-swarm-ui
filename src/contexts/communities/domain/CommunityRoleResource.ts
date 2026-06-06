import type { CommunityPermission } from './CommunityPermission';

export type CommunityRoleResource = {
  builtIn?: boolean;
  id: string;
  name: string;
  permissions: CommunityPermission[];
};
