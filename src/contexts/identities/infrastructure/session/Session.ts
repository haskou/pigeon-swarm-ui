import type { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { DeviceSealedRootGeneration } from '../../domain/value-objects/DeviceSealedRootGeneration';
import type { IdentityResource } from '../http/resources/IdentityResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';

export type Session = {
  authorizationEpoch: DeviceAuthorizationEpoch;
  authorizationRevision: DeviceAuthorizationRevision;
  deviceCredentialKeyPair: KeyPair;
  deviceId: DeviceId;
  /**
   * The generation of the publication `deviceSealedRootKey` was read from or
   * published at. Local stores order roots by it.
   */
  deviceSealedRootGeneration?: DeviceSealedRootGeneration;
  deviceSealedRootKey?: SymmetricKey;
  identity: IdentityResource;
  keyPair: KeyPair;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  masterKey: SymmetricKey;
  /**
   * The root a revoke on this device replaced, held in memory only. Inboxes
   * created under it register the new root through it.
   */
  previousDeviceSealedRootKey?: SymmetricKey;
  recoveryAuthorityKeyPair: KeyPair;
};
