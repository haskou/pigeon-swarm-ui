import { Timestamp } from '@haskou/value-objects';

import { NotificationRecipientId } from '../../../domain/value-objects/NotificationRecipientId';
import { PushSubscriptionCredential } from '../../../domain/value-objects/PushSubscriptionCredential';
import { PushSubscriptionEndpoint } from '../../../domain/value-objects/PushSubscriptionEndpoint';
import { PushSubscriptionExpiration } from '../../../domain/value-objects/PushSubscriptionExpiration';

export class RegisterPushSubscriptionMessage {
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

  public getAuth(): PushSubscriptionCredential {
    return PushSubscriptionCredential.fromString(this.primitives.auth);
  }

  public getEndpoint(): PushSubscriptionEndpoint {
    return PushSubscriptionEndpoint.fromString(this.primitives.endpoint);
  }

  public getExpiration(): PushSubscriptionExpiration {
    return PushSubscriptionExpiration.fromPrimitives(
      this.primitives.expirationTime,
    );
  }

  public getOccurredAt(): Timestamp {
    return new Timestamp(this.primitives.occurredAt);
  }

  public getP256dh(): PushSubscriptionCredential {
    return PushSubscriptionCredential.fromString(this.primitives.p256dh);
  }

  public getRecipientIdentityId(): NotificationRecipientId {
    return NotificationRecipientId.fromString(
      this.primitives.recipientIdentityId,
    );
  }
}
