import type { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';

import type { DeviceId } from '../../domain/value-objects/DeviceId';
import type { DeviceRootKeyEnvelope } from '../../domain/value-objects/DeviceRootKeyEnvelope';
import type { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import type { IdentityId } from '../../domain/value-objects/IdentityId';

export type ProtectedDeviceIdentity = {
  deviceId: DeviceId;
  encryptedMaterial: EncryptedPayload;
  envelope: DeviceRootKeyEnvelope;
  factorKey: CryptoKey;
  identityId: IdentityId;
  secretHandle: DeviceUnlockSecretHandle;
};
