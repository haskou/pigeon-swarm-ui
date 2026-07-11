import type {
  LocalKeychain,
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  Session,
} from '../../shared/domain/pigeonResources.types';

import { AcceptConversationInvitation } from '../../contexts/notifications/application/accept-conversation-invitation/AcceptConversationInvitation';
import { AcceptConversationInvitationMessage } from '../../contexts/notifications/application/accept-conversation-invitation/messages/AcceptConversationInvitationMessage';
import { ListNotificationSettings } from '../../contexts/notifications/application/list-notification-settings/ListNotificationSettings';
import { ListNotificationSettingsMessage } from '../../contexts/notifications/application/list-notification-settings/messages/ListNotificationSettingsMessage';
import { ListNotifications } from '../../contexts/notifications/application/list-notifications/ListNotifications';
import { ListNotificationsMessage } from '../../contexts/notifications/application/list-notifications/messages/ListNotificationsMessage';
import { ResetNotificationSettingMessage } from '../../contexts/notifications/application/reset-notification-setting/messages/ResetNotificationSettingMessage';
import { ResetNotificationSetting } from '../../contexts/notifications/application/reset-notification-setting/ResetNotificationSetting';
import { SaveNotificationSettingMessage } from '../../contexts/notifications/application/save-notification-setting/messages/SaveNotificationSettingMessage';
import { SaveNotificationSetting } from '../../contexts/notifications/application/save-notification-setting/SaveNotificationSetting';
import { UpdateNotificationMessage } from '../../contexts/notifications/application/update-notification/messages/UpdateNotificationMessage';
import { UpdateNotification } from '../../contexts/notifications/application/update-notification/UpdateNotification';
import { PigeonApiGateway } from './PigeonApiGateway';
import { pushSubscriptionPayload } from './pushSubscriptionPayload';

export class PigeonNotificationsApplication {
  private readonly acceptInvitation: AcceptConversationInvitation;

  private readonly listNotifications: ListNotifications;

  private readonly listSettings: ListNotificationSettings;

  private readonly resetSetting: ResetNotificationSetting;

  private readonly saveSetting: SaveNotificationSetting;

  private readonly updateNotification: UpdateNotification;

  public constructor(private readonly gateway: PigeonApiGateway) {
    this.acceptInvitation = new AcceptConversationInvitation(gateway);
    this.listNotifications = new ListNotifications(gateway);
    this.listSettings = new ListNotificationSettings({
      listNotificationSettings: async (session) =>
        await gateway.listNotificationSettings(session),
    });
    this.resetSetting = new ResetNotificationSetting({
      resetNotificationSetting: async (session, scope) =>
        await gateway.resetNotificationSetting(session, scope),
    });
    this.saveSetting = new SaveNotificationSetting({
      saveNotificationSetting: async (session, setting) =>
        await gateway.saveNotificationSetting(session, setting),
    });
    this.updateNotification = new UpdateNotification(gateway);
  }

  public async acceptConversationInvitation(
    session: Session,
    notification: NotificationResource,
  ): Promise<{
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
    notification: NotificationResource;
  }> {
    return await this.acceptInvitation.accept(
      new AcceptConversationInvitationMessage({ notification, session }),
    );
  }

  public async deletePushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.gateway.deletePushSubscription(
      session,
      pushSubscriptionPayload(subscription),
    );
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.gateway.getPushVapidPublicKey();
  }

  public async list(session: Session): Promise<NotificationResource[]> {
    return await this.listNotifications.list(
      new ListNotificationsMessage(session),
    );
  }

  public async listNotificationSettings(
    session: Session,
  ): Promise<NotificationScopeSetting[]> {
    return await this.listSettings.list(
      new ListNotificationSettingsMessage(session),
    );
  }

  public async registerPushSubscription(
    session: Session,
    subscription: PushSubscriptionJSON,
  ): Promise<void> {
    await this.gateway.registerPushSubscription(
      session,
      pushSubscriptionPayload(subscription),
    );
  }

  public async resetNotificationSetting(
    session: Session,
    scope: NotificationSettingScope,
  ): Promise<void> {
    await this.resetSetting.reset(
      new ResetNotificationSettingMessage({ scope, session }),
    );
  }

  public async saveNotificationSetting(
    session: Session,
    setting: NotificationScopeSettingInput,
  ): Promise<NotificationScopeSetting> {
    return await this.saveSetting.save(
      new SaveNotificationSettingMessage({ session, setting }),
    );
  }

  public async update(
    session: Session,
    notificationId: string,
    state: 'accepted' | 'declined',
  ): Promise<NotificationResource> {
    return await this.updateNotification.update(
      new UpdateNotificationMessage({ notificationId, session, state }),
    );
  }
}
