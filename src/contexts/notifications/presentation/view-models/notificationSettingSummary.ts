import type { NotificationScopeSetting } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { NotificationSettingsPolicy } from './NotificationSettingsPolicy';

export function notificationSettingSummary(
  setting: NotificationScopeSetting,
): string {
  if (NotificationSettingsPolicy.isMuted(setting)) {
    return copy.notifications.levelNone;
  }

  if (setting.notificationLevel === 'mentions') {
    return copy.notifications.levelMentions;
  }

  if (setting.notificationLevel === 'none') {
    return copy.notifications.levelNone;
  }

  return copy.notifications.levelAll;
}
