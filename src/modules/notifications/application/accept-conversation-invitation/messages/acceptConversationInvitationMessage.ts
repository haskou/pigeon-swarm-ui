import type { NotificationResource, Session } from '../../../../../shared/domain/pigeonResources.types';

export class AcceptConversationInvitationMessage {
  public constructor(
    private readonly input: {
      notification: NotificationResource;
      session: Session;
    },
  ) {}

  public getNotification(): NotificationResource {
    return this.input.notification;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
