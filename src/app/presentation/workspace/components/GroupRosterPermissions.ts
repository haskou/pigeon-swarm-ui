export interface GroupRosterPermissions {
  canDemote: (identityId: string) => boolean;
  canLeave: boolean;
  canPromote: (identityId: string) => boolean;
  canRemove: (identityId: string) => boolean;
}
