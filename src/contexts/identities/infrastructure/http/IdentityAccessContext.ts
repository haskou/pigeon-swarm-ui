import type { Session } from '../../../../shared/domain/pigeonResources.types';

export type IdentityAccessContext = {
  newPassword?: string;
  options: {
    currentPassword?: string;
    recoveryKey?: string;
  };
  session: Session;
};
