import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DeviceIdentityKeyMaterial } from './DeviceIdentityKeyMaterial';

export type ProtectDeviceIdentityInput = {
  deviceId: DeviceId;
  identityId: IdentityId;
  material: DeviceIdentityKeyMaterial;
  password: string;
  secretHandle: DeviceUnlockSecretHandle;
};
