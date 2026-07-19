import type { ConversationInvitationAcceptor } from '../../../contexts/notifications/application/accept-conversation-invitation/ConversationInvitationAcceptor';
import type { NotificationSettingConfigurer } from '../../../contexts/notifications/application/configure-notification-setting/NotificationSettingConfigurer';
import type { NotificationDecider } from '../../../contexts/notifications/application/decide-notification/NotificationDecider';
import type { PushNotificationServerFinder } from '../../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import type { PushSubscriptionRegistrar } from '../../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';
import type { PushSubscriptionRemover } from '../../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';
import type { NotificationSettingResetter } from '../../../contexts/notifications/application/reset-notification-setting/NotificationSettingResetter';
import type { NotificationSettingsSearcher } from '../../../contexts/notifications/application/search-notification-settings/NotificationSettingsSearcher';
import type { NotificationsSearcher } from '../../../contexts/notifications/application/search-notifications/NotificationsSearcher';

export interface NotificationUseCases {
  invitationAcceptor: ConversationInvitationAcceptor;
  notificationDecider: NotificationDecider;
  notificationSearcher: NotificationsSearcher;
  pushServerFinder: PushNotificationServerFinder;
  pushSubscriptionRegistrar: PushSubscriptionRegistrar;
  pushSubscriptionRemover: PushSubscriptionRemover;
  settingConfigurer: NotificationSettingConfigurer;
  settingResetter: NotificationSettingResetter;
  settingSearcher: NotificationSettingsSearcher;
}
