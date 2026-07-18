import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { PushSubscriptionCredential } from './value-objects/PushSubscriptionCredential';
import { PushSubscriptionEndpoint } from './value-objects/PushSubscriptionEndpoint';
import { PushSubscriptionEventType } from './value-objects/PushSubscriptionEventType';
import { PushSubscriptionExpiration } from './value-objects/PushSubscriptionExpiration';

export class PushSubscription extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<PushSubscription>,
  ): PushSubscription {
    return new PushSubscription(
      PushSubscriptionEndpoint.fromString(primitives.endpoint),
      PushSubscriptionExpiration.fromPrimitives(primitives.expirationTime),
      PushSubscriptionCredential.fromString(primitives.auth),
      PushSubscriptionCredential.fromString(primitives.p256dh),
    );
  }

  public static register(
    endpoint: PushSubscriptionEndpoint,
    expiration: PushSubscriptionExpiration,
    auth: PushSubscriptionCredential,
    p256dh: PushSubscriptionCredential,
    occurredAt: Timestamp,
  ): PushSubscription {
    const subscription = new PushSubscription(
      endpoint,
      expiration,
      auth,
      p256dh,
    );

    subscription.recordChange(PushSubscriptionEventType.REGISTERED, occurredAt);

    return subscription;
  }

  private constructor(
    private readonly endpoint: PushSubscriptionEndpoint,
    private readonly expiration: PushSubscriptionExpiration,
    private readonly auth: PushSubscriptionCredential,
    private readonly p256dh: PushSubscriptionCredential,
  ) {
    super();
  }

  private recordChange(
    type: PushSubscriptionEventType,
    occurredAt: Timestamp,
  ): void {
    this.record({
      aggregateId: this.endpoint.toString(),
      occurredAt: occurredAt.valueOf(),
      type: type.valueOf(),
    });
  }

  public remove(occurredAt: Timestamp): void {
    this.recordChange(PushSubscriptionEventType.REMOVED, occurredAt);
  }

  public toPrimitives() {
    return {
      auth: this.auth.toString(),
      endpoint: this.endpoint.toString(),
      expirationTime: this.expiration.toPrimitives(),
      p256dh: this.p256dh.toString(),
    };
  }
}
