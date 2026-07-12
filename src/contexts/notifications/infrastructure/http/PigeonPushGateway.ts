import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonPushApi, type PushSubscriptionPayload } from './PigeonPushApi';

export class PigeonPushGateway {
  public constructor(private readonly push: PigeonPushApi) {}

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.push.getVapidPublicKey();
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.registerSubscription(session, subscription);
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.deleteSubscription(session, subscription);
  }
}
