import type { NotificationScopeSettingInputResource as NotificationScopeSettingInput } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingInputResource';
import type { NotificationScopeSettingResource as NotificationScopeSetting } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationScopeSettingResource';
import type { NotificationScopeSettingsTarget } from '../../../../contexts/notifications/presentation/components/NotificationScopeSettingsDialog';

export type WorkspaceNotificationSettingsDialog = {
  error: null | string;
  onClose: () => void;
  onReset: (scope: NotificationScopeSettingsTarget['scope']) => void;
  onSave: (setting: NotificationScopeSettingInput) => void;
  setting: NotificationScopeSetting | null;
  target: NotificationScopeSettingsTarget | null;
};
