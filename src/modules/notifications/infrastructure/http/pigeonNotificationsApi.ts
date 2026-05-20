import type { NotificationResource, Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/httpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/requestSigner';
import type { NotificationDecision } from '../../domain/notificationDecision';
import type { NotificationId } from '../../domain/notificationId';

type CachedRequest = <T>(key: string, loader: () => Promise<T>) => Promise<T>;

export class PigeonNotificationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cachedRequest: CachedRequest,
  ) {}

  public async list(session: Session): Promise<NotificationResource[]> {
    const path = '/notifications/?limit=30';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{ results: NotificationResource[] }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
    );

    return result.results;
  }

  public async update(
    session: Session,
    notificationId: NotificationId,
    decision: NotificationDecision,
  ): Promise<NotificationResource> {
    const path = `/notifications/${encodeURIComponent(notificationId.toString())}`;
    const body = { state: decision.toString() };

    return await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }
}
