import type { NotificationScopeSettingsTarget } from '../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog';
import type {
  NotificationScopeSetting,
  NotificationScopeSettingInput,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceNotificationSettingsDialog = {
  error: null | string;
  onClose: () => void;
  onReset: (scope: NotificationScopeSettingsTarget['scope']) => void;
  onSave: (setting: NotificationScopeSettingInput) => void;
  setting: NotificationScopeSetting | null;
  target: NotificationScopeSettingsTarget | null;
};
