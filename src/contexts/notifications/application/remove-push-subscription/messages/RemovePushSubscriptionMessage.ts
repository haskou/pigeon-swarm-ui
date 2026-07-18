import { Timestamp } from '@haskou/value-objects';

import { PushSubscription } from '../../../domain/PushSubscription';
import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';

export class RemovePushSubscriptionMessage {
  public constructor(
    private readonly primitives: {
      auth: string;
      endpoint: string;
      expirationTime?: number | null;
      occurredAt: number;
      p256dh: string;
      recipientIdentityId: string;
    },
  ) {}

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.primitives.occurredAt);
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(
      this.primitives.recipientIdentityId,
    );
  }

  public getSubscription(): PushSubscription {
    return PushSubscription.fromPrimitives({
      auth: this.primitives.auth,
      endpoint: this.primitives.endpoint,
      expirationTime: this.primitives.expirationTime,
      p256dh: this.primitives.p256dh,
    });
  }
}
