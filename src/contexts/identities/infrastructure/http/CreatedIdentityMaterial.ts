import type { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

export type CreatedIdentityMaterial = {
  authorizationEpoch: import('../../domain/value-objects/DeviceAuthorizationEpoch').DeviceAuthorizationEpoch;
  authorizationRevision: import('../../domain/value-objects/DeviceAuthorizationRevision').DeviceAuthorizationRevision;
  deviceCredentialKeyPair: KeyPair;
  deviceId: import('../../domain/value-objects/DeviceId').DeviceId;
  identity: IdentityResource;
  keyPair: KeyPair;
  masterKey: SymmetricKey;
  recoveryAuthorityKeyPair: KeyPair;
};
