import type { ConversationInvitationAcceptor } from '../../../contexts/notifications/application/accept-conversation-invitation/ConversationInvitationAcceptor';
import type { NotificationSettingConfigurer } from '../../../contexts/notifications/application/configure-notification-setting/NotificationSettingConfigurer';
import type { NotificationDecider } from '../../../contexts/notifications/application/decide-notification/NotificationDecider';
import type { NotificationSettingResetter } from '../../../contexts/notifications/application/reset-notification-setting/NotificationSettingResetter';
import type { NotificationSettingsSearcher } from '../../../contexts/notifications/application/search-notification-settings/NotificationSettingsSearcher';
import type { NotificationsSearcher } from '../../../contexts/notifications/application/search-notifications/NotificationsSearcher';

export interface NotificationUseCases {
  invitationAcceptor: ConversationInvitationAcceptor;
  notificationDecider: NotificationDecider;
  notificationSearcher: NotificationsSearcher;
  settingConfigurer: NotificationSettingConfigurer;
  settingResetter: NotificationSettingResetter;
  settingSearcher: NotificationSettingsSearcher;
}
