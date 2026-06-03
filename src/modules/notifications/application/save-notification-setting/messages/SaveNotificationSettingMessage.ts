import type {
  NotificationScopeSettingInput,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { NotificationSettingsPolicy } from '../../../domain/NotificationSettingsPolicy';

export class SaveNotificationSettingMessage {
  private readonly setting: NotificationScopeSettingInput;

  private readonly session: Session;

  public constructor(input: {
    session: Session;
    setting: NotificationScopeSettingInput;
  }) {
    this.session = input.session;
    this.setting = NotificationSettingsPolicy.normalize(input.setting);
  }

  public getSession(): Session {
    return this.session;
  }

  public getSetting(): NotificationScopeSettingInput {
    return this.setting;
  }
}
