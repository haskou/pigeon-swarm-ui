import type { OwnDeviceRepository } from '../../domain/repositories/OwnDeviceRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContexts } from './IdentityAccessContexts';
import type { PigeonIdentitiesGateway } from './PigeonIdentitiesGateway';

import { DeviceRetirement } from '../../domain/value-objects/DeviceRetirement';

/** Retires the credential of the registered session's device on the node. */
export class PigeonOwnDeviceRepository implements OwnDeviceRepository {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
  ) {}

  public async retire(identityId: IdentityId): Promise<DeviceRetirement> {
    const { session } = this.contexts.find(identityId);

    return DeviceRetirement.fromPrimitives(
      await this.gateway.retireOwnDevice(session),
    );
  }
}
