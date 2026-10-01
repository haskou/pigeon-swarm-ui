import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DeviceIdentityVaultRecord } from './DeviceIdentityVaultRecord';

export interface DeviceIdentityVaultStore {
  advanceAuthorization(
    identityId: IdentityId,
    previousRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
  ): Promise<void>;
  synchronizeAuthorization(
    identityId: IdentityId,
    localRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
    revision: DeviceAuthorizationRevision,
  ): Promise<void>;
  delete(identityId: IdentityId): Promise<void>;
  find(identityId: IdentityId): Promise<DeviceIdentityVaultRecord | undefined>;
  save(record: DeviceIdentityVaultRecord): Promise<void>;
  replaceProtection(
    expected: DeviceIdentityVaultRecord,
    next: DeviceIdentityVaultRecord,
  ): Promise<void>;
}
