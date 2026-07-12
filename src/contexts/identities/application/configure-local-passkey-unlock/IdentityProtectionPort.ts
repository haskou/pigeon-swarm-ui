import type { Session } from '../../../../shared/domain/pigeonResources.types';

export interface IdentityProtectionPort {
  configureLocalPasskeyUnlock(
    session: Session,
    password: string,
    enabled: boolean,
    recoveryKey?: string,
  ): Promise<void>;
}
