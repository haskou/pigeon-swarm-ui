import type { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceHistoryFloor } from '../../domain/value-objects/DeviceHistoryFloor';
import type { Session } from '../session/Session';

export type CompletedDevicePairing = {
  historyFloor: DeviceHistoryFloor;
  historyTransferSecret: SymmetricKey;
  session: Session;
};
