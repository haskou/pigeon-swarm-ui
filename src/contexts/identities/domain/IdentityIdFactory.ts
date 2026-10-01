import type { IdentityId } from './value-objects/IdentityId';
import type { RecoveryKey } from './value-objects/RecoveryKey';

export interface IdentityIdFactory {
  create(recoveryKey: RecoveryKey): Promise<IdentityId>;
}
