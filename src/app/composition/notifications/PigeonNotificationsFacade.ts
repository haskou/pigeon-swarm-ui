import type {
  LocalKeychain,
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { NotificationUseCases } from './NotificationUseCases';

import { AcceptConversationInvitationMessage } from '../../../contexts/notifications/application/accept-conversation-invitation/messages/AcceptConversationInvitationMessage';
import { ConfigureNotificationSettingMessage } from '../../../contexts/notifications/application/configure-notification-setting/messages/ConfigureNotificationSettingMessage';
import { DecideNotificationMessage } from '../../../contexts/notifications/application/decide-notification/messages/DecideNotificationMessage';
import { RegisterPushSubscriptionMessage } from '../../../contexts/notifications/application/register-push-subscription/messages/RegisterPushSubscriptionMessage';
import { RemovePushSubscriptionMessage } from '../../../contexts/notifications/application/remove-push-subscription/messages/RemovePushSubscriptionMessage';
import { ResetNotificationSettingMessage } from '../../../contexts/notifications/application/reset-notification-setting/messages/ResetNotificationSettingMessage';
import { SearchNotificationSettingsMessage } from '../../../contexts/notifications/application/search-notification-settings/messages/SearchNotificationSettingsMessage';
import { SearchNotificationsMessage } from '../../../contexts/notifications/application/search-notifications/messages/SearchNotificationsMessage';
import { NotificationRecipientId } from '../../../contexts/notifications/domain/value-objects/NotificationRecipientId';
import { NotificationAccessContexts } from '../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../../contexts/notifications/infrastructure/http/NotificationMapper';
import { NotificationSettingMapper } from '../../../contexts/notifications/infrastructure/http/NotificationSettingMapper';

export class PigeonNotificationsFacade {
  public constructor(
    private readonly contexts: NotificationAccessContexts,
    private readonly notificationMapper: NotificationMapper,
    private readonly settingMapper: NotificationSettingMapper,
    private readonly useCases: NotificationUseCases,
  ) {}

  private actor(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }

  private scopeIdentifiers(scope: NotificationSettingScope): {
    first: string;
    second?: string;
  } {
    if (scope.type === 'conversation') {
      return { first: scope.conversationId };
    }

    return scope.type === 'community'
      ? { first: scope.communityId }
      : { first: scope.communityId, second: scope.channelId };
  }

  public async acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    if (notification.type === 'missed_call') {
      throw new Error('Missed call notifications cannot be accepted.');
    }

    const recipientIdentityId = this.actor(session);
    const encryptedInvitationKey =
      notification.type === 'community_invitation'
        ? notification.payload.encryptedCommunityKey
        : notification.payload.encryptedConversationKey;
    const accepted = await this.useCases.invitationAcceptor.accept(
      new AcceptConversationInvitationMessage(
        notification.id,
        recipientIdentityId,
        encryptedInvitationKey,
        Date.now(),
      ),
    );
    const updatedSession = this.contexts.find(
      NotificationRecipientId.fromString(recipientIdentityId),
    );

    return {
      keychain: updatedSession.keychain,
      keychainExternalIdentifier:
        updatedSession.keychainExternalIdentifier ?? '',
      notification: this.notificationMapper.toResource(accepted),
    };
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.useCases.pushSubscriptionRemover.remove(
      new RemovePushSubscriptionMessage({
        auth: subscription.keys?.auth ?? '',
        endpoint: subscription.endpoint ?? '',
        expirationTime: subscription.expirationTime,
        occurredAt: Date.now(),
        p256dh: subscription.keys?.p256dh ?? '',
        recipientIdentityId: this.actor(session),
      }),
    );
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    const server = await this.useCases.pushServerFinder.find();

    return server.toPrimitives();
  }

  public async list(session: Session): Promise<NotificationResource[]> {
    const notifications = await this.useCases.notificationSearcher.search(
      new SearchNotificationsMessage(this.actor(session)),
    );

    return notifications.map((notification) =>
      this.notificationMapper.toResource(notification),
    );
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    const settings = await this.useCases.settingSearcher.search(
      new SearchNotificationSettingsMessage(this.actor(session)),
    );

    return settings.map((setting) => this.settingMapper.toResource(setting));
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.useCases.pushSubscriptionRegistrar.register(
      new RegisterPushSubscriptionMessage({
        auth: subscription.keys?.auth ?? '',
        endpoint: subscription.endpoint ?? '',
        expirationTime: subscription.expirationTime,
        occurredAt: Date.now(),
        p256dh: subscription.keys?.p256dh ?? '',
        recipientIdentityId: this.actor(session),
      }),
    );
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    const identifiers = this.scopeIdentifiers(scope);

    await this.useCases.settingResetter.reset(
      new ResetNotificationSettingMessage(
        this.actor(session),
        scope.type,
        identifiers.first,
        identifiers.second,
        Date.now(),
      ),
    );
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    const identifiers = this.scopeIdentifiers(setting.scope);
    const saved = await this.useCases.settingConfigurer.configure(
      new ConfigureNotificationSettingMessage({
        firstScopeIdentifier: identifiers.first,
        hideMutedChannels: setting.hideMutedChannels,
        mobilePushEnabled: setting.mobilePushEnabled,
        mutedUntil: setting.mutedUntil,
        notificationLevel: setting.notificationLevel,
        occurredAt: Date.now(),
        recipientIdentityId: this.actor(session),
        scopeType: setting.scope.type,
        secondScopeIdentifier: identifiers.second,
        suppressEveryoneAndHere: setting.suppressEveryoneAndHere,
        suppressRoleMentions: setting.suppressRoleMentions,
      }),
    );

    return this.settingMapper.toResource(saved);
  }

  public async update(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    const notification = await this.useCases.notificationDecider.decide(
      new DecideNotificationMessage(
        notificationId,
        this.actor(session),
        state,
        Date.now(),
      ),
    );

    return this.notificationMapper.toResource(notification);
  }
}
