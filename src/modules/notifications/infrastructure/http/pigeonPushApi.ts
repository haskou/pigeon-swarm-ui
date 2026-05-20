import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/httpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/requestSigner';

export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export class PigeonPushApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  public async getVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.http.request<{
      enabled: boolean;
      publicKey?: string;
    }>('/push/vapid-public-key', {
      method: 'GET',
    });
  }

  public async registerSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    const path = '/push/subscriptions';

    await this.http.request(path, {
      body: JSON.stringify(subscription),
      headers: await this.signer.headers(session, 'PUT', path, subscription),
      method: 'PUT',
    });
  }

  public async deleteSubscription(
    session: Session,
    subscription: PushSubscriptionPayload,
  ): Promise<void> {
    const path = '/push/subscriptions';

    await this.http.request(path, {
      body: JSON.stringify(subscription),
      headers: await this.signer.headers(session, 'DELETE', path, subscription),
      method: 'DELETE',
    });
  }
}
