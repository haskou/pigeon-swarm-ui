import type { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { IdentityResource } from '../http/resources/IdentityResource';
import type { LocalKeychain } from '../keychain/LocalKeychain';

export type Session = {
  authorizationEpoch: DeviceAuthorizationEpoch;
  authorizationRevision: DeviceAuthorizationRevision;
  deviceCredentialKeyPair: KeyPair;
  deviceId: DeviceId;
  identity: IdentityResource;
  keyPair: KeyPair;
  keychain: LocalKeychain;
  keychainExternalIdentifier?: string | null;
  masterKey: SymmetricKey;
  recoveryAuthorityKeyPair: KeyPair;
};
