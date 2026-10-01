import type { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';

export class DevicePairingMaterial {
  public constructor(
    private readonly identityKeyPair: KeyPair,
    private readonly recoveryAuthorityKeyPair: KeyPair,
    private readonly rootKey: UserRootKey,
  ) {}

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
