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
import type { CachedGetRequest } from './CachedGetRequest';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

const startupReadCacheTtlMs = 1500;

export class PigeonNotificationsApi {
  private readonly mutations = new PublicMutationSigner();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cachedRequest: CachedGetRequest,
  ) {}

  private scopeKey(scope: NotificationSettingScope): string {
    if (scope.type === 'conversation') {
      return `${scope.type}:${scope.conversationId}`;
    }

    if (scope.type === 'community_channel') {
      return `${scope.type}:${scope.communityId}:${scope.channelId}`;
    }

    return `${scope.type}:${scope.communityId}`;
  }

  private async sendMutation(
    session: Session,
    method: 'DELETE' | 'PUT',
    kind: 'delete' | 'put',
    payload: Record<string, unknown>,
    fields: Record<string, unknown>,
  ): Promise<NotificationScopeSetting | undefined> {
    const path = '/notification-settings/scopes';
    let response: NotificationScopeSetting | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            kind,
            payload,
            recordId: String(payload.id),
            store: 'notificationSettings',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        response = await this.http.request<NotificationScopeSetting>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response;
  }

  public async list(session: Session): Promise<NotificationResource[]> {
    const path = '/notifications/?limit=30';
    const result = await this.http.request<{ results: NotificationResource[] }>(
      path,
      {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      },
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
    const identityId = this.mutations.authorOf(session);
    const scopeKey = this.scopeKey(setting.scope);
    const updatedAt = Date.now();
    const payload = {
      hideMutedChannels: setting.hideMutedChannels ?? false,
      id: `${identityId}:${scopeKey}`,
      identityId,
      mobilePushEnabled: setting.mobilePushEnabled ?? true,
      ...(setting.mutedUntil === undefined
        ? {}
        : { mutedUntil: setting.mutedUntil }),
      notificationLevel: setting.notificationLevel,
      scope: setting.scope,
      scopeKey,
      scopeType: 'notification_settings',
      suppressEveryoneAndHere: setting.suppressEveryoneAndHere ?? false,
      suppressRoleMentions: setting.suppressRoleMentions ?? false,
      updatedAt,
    };
    const response = await this.sendMutation(session, 'PUT', 'put', payload, {
      ...setting,
      updatedAt,
    });

    return response as NotificationScopeSetting;
  }

  public async resetSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    const identityId = this.mutations.authorOf(session);
    const scopeKey = this.scopeKey(scope);

    await this.sendMutation(
      session,
      'DELETE',
      'delete',
      {
        id: `${identityId}:${scopeKey}`,
        identityId,
        removed: true,
        scopeKey,
        scopeType: 'notification_settings',
      },
      { scope },
    );
  }

  public async update(
    session: Session,
    notificationId: string,
    state: string,
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
