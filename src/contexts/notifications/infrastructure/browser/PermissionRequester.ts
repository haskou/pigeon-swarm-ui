import type { Permission } from './Permission';

export type PermissionRequester = () => Promise<Permission>;
