import type { NotificationResource, Session } from '../../domain/types';
import type { HttpJsonClient } from '../http/HttpJsonClient';
import type { RequestSigner } from './RequestSigner';

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
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    const path = `/notifications/${encodeURIComponent(notificationId)}`;
    const body = { state };

    return await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }
}
