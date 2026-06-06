import type { Session } from '../../../shared/domain/pigeonResources.types';

import {
  PigeonPushApi,
  type PushSubscriptionPayload,
} from '../../../contexts/notifications/infrastructure/http/pigeonPushApi';

export class PigeonPushGateway {
  public constructor(private readonly push: PigeonPushApi) {}

  public async getVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.push.getVapidPublicKey();
  }

  public async registerSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.registerSubscription(session, subscription);
  }

  public async deleteSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    await this.push.deleteSubscription(session, subscription);
  }
}
