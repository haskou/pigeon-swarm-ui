import type { Session } from '../../../../../domain/types';

import { NotificationDecision } from '../../../domain/notificationDecision';
import { NotificationId } from '../../../domain/notificationId';

export class UpdateNotificationMessage {
  private readonly decision: NotificationDecision;

  private readonly notificationId: NotificationId;

  private readonly session: Session;

  public constructor(
    input: {
      notificationId: string;
      session: Session;
      state: string;
    },
  ) {
    this.decision = NotificationDecision.fromState(input.state);
    this.notificationId = NotificationId.fromString(input.notificationId);
    this.session = input.session;
  }

  public getNotificationId(): NotificationId {
    return this.notificationId;
  }

  public getSession(): Session {
    return this.session;
  }

  public getDecision(): NotificationDecision {
    return this.decision;
  }
}
