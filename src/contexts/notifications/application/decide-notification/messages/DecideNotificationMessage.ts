import { Timestamp } from '@haskou/value-objects';

import { NotificationDecision } from '../../../domain/value-objects/NotificationDecision';
import { NotificationId } from '../../../domain/value-objects/NotificationId';
import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';

export class DecideNotificationMessage {
  public constructor(
    private readonly notificationId: string,
    private readonly recipientIdentityId: string,
    private readonly decision: string,
    private readonly occurredAt: number,
  ) {}

  public getDecision(): NotificationDecision {
    return NotificationDecision.fromPrimitives(this.decision);
  }

  public getNotificationId(): NotificationId {
    return NotificationId.fromString(this.notificationId);
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.occurredAt);
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(this.recipientIdentityId);
  }
}
