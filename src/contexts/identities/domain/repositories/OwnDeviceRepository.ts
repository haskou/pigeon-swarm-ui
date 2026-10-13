import type { DeviceRetirement } from '../value-objects/DeviceRetirement';
import type { IdentityId } from '../value-objects/IdentityId';

export interface OwnDeviceRepository {
  retire(identityId: IdentityId): Promise<DeviceRetirement>;
}
