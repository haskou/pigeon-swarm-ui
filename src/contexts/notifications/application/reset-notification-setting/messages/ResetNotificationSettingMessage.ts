import type {
  NotificationSettingScope,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

export class ResetNotificationSettingMessage {
  private readonly scope: NotificationSettingScope;

  private readonly session: Session;

  public constructor(input: {
    scope: NotificationSettingScope;
    session: Session;
  }) {
    this.scope = input.scope;
    this.session = input.session;
  }

  public getScope(): NotificationSettingScope {
    return this.scope;
  }

  public getSession(): Session {
    return this.session;
  }
}
