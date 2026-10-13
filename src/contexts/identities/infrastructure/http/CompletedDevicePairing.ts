import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../session/Session';

export type CompletedDevicePairing = {
  historyTransferSecret?: SymmetricKey;
  session: Session;
};
