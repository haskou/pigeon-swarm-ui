import type {
  LocalKeychain,
  NotificationResource,
  NotificationScopeSetting,
  NotificationScopeSettingInput,
  NotificationSettingScope,
  Session,
} from '../../../shared/domain/pigeonResources.types';
import type { ConversationInvitationKeychainPublisher } from './accept-conversation-invitation/ConversationInvitationKeychainPublisher';
import type { ConversationInvitationKeyDecryptor } from './accept-conversation-invitation/ConversationInvitationKeyDecryptor';
import type { ListNotificationSettingsPort } from './ports/ListNotificationSettingsPort';
import type { ListNotificationsPort } from './ports/ListNotificationsPort';
import type { PushNotificationPort } from './ports/PushNotificationPort';
import type { ResetNotificationSettingPort } from './ports/ResetNotificationSettingPort';
import type { SaveNotificationSettingPort } from './ports/SaveNotificationSettingPort';
import type { UpdateNotificationPort } from './ports/UpdateNotificationPort';

import { PushSubscriptionPayloadFactory } from '../infrastructure/http/PushSubscriptionPayloadFactory';
import { AcceptConversationInvitation } from './accept-conversation-invitation/AcceptConversationInvitation';
import { AcceptConversationInvitationMessage } from './accept-conversation-invitation/messages/AcceptConversationInvitationMessage';
import { ListNotificationSettings } from './list-notification-settings/ListNotificationSettings';
import { ListNotificationSettingsMessage } from './list-notification-settings/messages/ListNotificationSettingsMessage';
import { ListNotifications } from './list-notifications/ListNotifications';
import { ListNotificationsMessage } from './list-notifications/messages/ListNotificationsMessage';
import { ResetNotificationSettingMessage } from './reset-notification-setting/messages/ResetNotificationSettingMessage';
import { ResetNotificationSetting } from './reset-notification-setting/ResetNotificationSetting';
import { SaveNotificationSettingMessage } from './save-notification-setting/messages/SaveNotificationSettingMessage';
import { SaveNotificationSetting } from './save-notification-setting/SaveNotificationSetting';
import { UpdateNotificationMessage } from './update-notification/messages/UpdateNotificationMessage';
import { UpdateNotification } from './update-notification/UpdateNotification';

export class PigeonNotificationsApplication {
  private readonly acceptInvitation: AcceptConversationInvitation;

  private readonly listNotifications: ListNotifications;

  private readonly listSettings: ListNotificationSettings;

  private readonly resetSetting: ResetNotificationSetting;

  private readonly saveSetting: SaveNotificationSetting;

  private readonly updateNotification: UpdateNotification;

  private readonly push: PushNotificationPort;

  public constructor(dependencies: {
    acceptInvitation: {
      keyDecryptor: ConversationInvitationKeyDecryptor;
      keychainPublisher: ConversationInvitationKeychainPublisher;
      notifications: UpdateNotificationPort;
    };
    listNotificationSettings: ListNotificationSettingsPort;
    listNotifications: ListNotificationsPort;
    push: PushNotificationPort;
    resetNotificationSetting: ResetNotificationSettingPort;
    saveNotificationSetting: SaveNotificationSettingPort;
    updateNotification: UpdateNotificationPort;
  }) {
    this.acceptInvitation = new AcceptConversationInvitation(
      dependencies.acceptInvitation.keyDecryptor,
      dependencies.acceptInvitation.keychainPublisher,
      dependencies.acceptInvitation.notifications,
    );
    this.listNotifications = new ListNotifications(
      dependencies.listNotifications,
    );
    this.push = dependencies.push;
    this.listSettings = new ListNotificationSettings({
      listNotificationSettings: async (session) =>
        await dependencies.listNotificationSettings.listNotificationSettings(
          session,
        ),
    });
    this.resetSetting = new ResetNotificationSetting({
      resetNotificationSetting: async (session, scope) =>
        await dependencies.resetNotificationSetting.resetNotificationSetting(
          session,
          scope,
        ),
    });
    this.saveSetting = new SaveNotificationSetting({
      saveNotificationSetting: async (session, setting) =>
        await dependencies.saveNotificationSetting.saveNotificationSetting(
          session,
          setting,
        ),
    });
    this.updateNotification = new UpdateNotification(
      dependencies.updateNotification,
    );
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
    await this.push.deletePushSubscription(
      session,
      PushSubscriptionPayloadFactory.from(subscription),
    );
  }

  public async getPushVapidPublicKey(): Promise<{
    enabled: boolean;
    publicKey?: string;
  }> {
    return await this.push.getPushVapidPublicKey();
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
    await this.push.registerPushSubscription(
      session,
      PushSubscriptionPayloadFactory.from(subscription),
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
