import type {
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationScopeSettingsResource,
  NotificationSettingScope,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { NotificationDecision } from '../../domain/NotificationDecision';
import type { NotificationId } from '../../domain/NotificationId';
import type { CachedGetRequest } from './CachedGetRequest';

const startupReadCacheTtlMs = 1500;

export class PigeonNotificationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cachedRequest: CachedGetRequest,
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

  public async listSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    const path = '/notification-settings/';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<NotificationScopeSettingsResource>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return result.scopes;
  }

  public async saveSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    const path = '/notification-settings/scopes';
    const body = setting;

    return await this.http.request<NotificationScopeSetting>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });
  }

  public async resetSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    const path = '/notification-settings/scopes';
    const body = { scope };

    await this.http.request<void>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
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
