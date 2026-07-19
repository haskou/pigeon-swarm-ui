import type { PushNotificationServerRepository } from '../../domain/repositories/PushNotificationServerRepository';

import { PushNotificationServer } from '../../domain/PushNotificationServer';
import { PigeonPushApi } from './PigeonPushApi';

// prettier-ignore
export class PigeonPushNotificationServerRepository
  implements PushNotificationServerRepository {
  public constructor(private readonly api: PigeonPushApi) {}

  public async find(): Promise<PushNotificationServer> {
    const resource = await this.api.getVapidPublicKey();

    return PushNotificationServer.fromPrimitives({
      enabled: resource.enabled,
      publicKey: resource.publicKey,
    });
  }
}
