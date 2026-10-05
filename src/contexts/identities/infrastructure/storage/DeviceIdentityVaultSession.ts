import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import type { DeviceIdentityKeyMaterial } from '../crypto/DeviceIdentityKeyMaterial';

export type DeviceIdentityVaultSession = {
  authorizationEpoch: DeviceAuthorizationEpoch;
  authorizationRevision: DeviceAuthorizationRevision;
  deviceId: DeviceId;
  material: DeviceIdentityKeyMaterial;
  secretHandle: DeviceUnlockSecretHandle;
};
