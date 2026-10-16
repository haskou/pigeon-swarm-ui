import type { RecoveryKey } from '@haskou/pigeon-swarm-crypto';

import type { IdentityId } from './value-objects/IdentityId';

export interface IdentityIdFactory {
  create(recoveryKey: RecoveryKey): Promise<IdentityId>;
}
