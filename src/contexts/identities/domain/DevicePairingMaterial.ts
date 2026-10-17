import type {
  KeyPair,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';

import type { DeviceHistoryFloor } from './value-objects/DeviceHistoryFloor';

export class DevicePairingMaterial {
  public constructor(
    private readonly identityKeyPair: KeyPair,
    private readonly recoveryAuthorityKeyPair: KeyPair,
    private readonly rootKey: UserRootKey,
    private readonly historyTransferSecret: SymmetricKey,
    private readonly historyFloor: DeviceHistoryFloor,
  ) {}

  public getHistoryFloor(): DeviceHistoryFloor {
    return this.historyFloor;
  }

  public getHistoryTransferSecret(): SymmetricKey {
    return this.historyTransferSecret;
  }

  public getIdentityKeyPair(): KeyPair {
    return this.identityKeyPair;
  }

  public getRecoveryAuthorityKeyPair(): KeyPair {
    return this.recoveryAuthorityKeyPair;
  }

  public getRootKey(): UserRootKey {
    return this.rootKey;
  }
}
