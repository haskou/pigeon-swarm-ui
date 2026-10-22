import type { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import type { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type {
  DeviceIdentityVaultRecord,
  FirstKeychainPublishState,
} from './DeviceIdentityVaultRecord';

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
  clearFirstKeychainPublish(identityId: IdentityId): Promise<void>;
  transitionFirstKeychainPublish(
    identityId: IdentityId,
    from: FirstKeychainPublishState,
    to: FirstKeychainPublishState,
  ): Promise<boolean>;
  find(identityId: IdentityId): Promise<DeviceIdentityVaultRecord | undefined>;
  arm(record: DeviceIdentityVaultRecord): Promise<void>;
  save(record: DeviceIdentityVaultRecord): Promise<void>;
  replaceProtection(
    expected: DeviceIdentityVaultRecord,
    next: DeviceIdentityVaultRecord,
  ): Promise<void>;
}
