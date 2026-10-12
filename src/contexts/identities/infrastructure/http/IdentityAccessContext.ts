import type { Session } from '../session/Session';

export type IdentityAccessContext = {
  newPassword?: string;
  options: {
    currentPassword?: string;
    recoveryKey?: string;
  };
  session: Session;
};
