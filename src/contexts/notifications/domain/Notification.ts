import { Timestamp, assert, type PrimitiveOf } from '@haskou/value-objects';

import { AggregateRoot } from '../../../shared/domain/AggregateRoot';
import { NotificationCannotBeAnsweredError } from './errors/NotificationCannotBeAnsweredError';
import { NotificationDecision } from './value-objects/NotificationDecision';
import { NotificationEventType } from './value-objects/NotificationEventType';
import { NotificationId } from './value-objects/NotificationId';
import { NotificationRecipientId } from './value-objects/NotificationRecipientId';
import { NotificationState } from './value-objects/NotificationState';
import { NotificationType } from './value-objects/NotificationType';

export class Notification extends AggregateRoot {
  public static fromPrimitives(
    primitives: PrimitiveOf<Notification>,
  ): Notification {
    return new Notification(
      NotificationId.fromString(primitives.id),
      NotificationRecipientId.fromString(primitives.recipientIdentityId),
      NotificationState.fromPrimitives(primitives.state),
      NotificationType.fromPrimitives(primitives.type),
    );
  }

  private constructor(
    private readonly id: NotificationId,
    private readonly recipientIdentityId: NotificationRecipientId,
    private state: NotificationState,
    private readonly type: NotificationType,
  ) {
    super();
  }

  public belongsTo(id: NotificationId): boolean {
    return this.id.isEqual(id);
  }

  public decide(decision: NotificationDecision, occurredAt: Timestamp): void {
    assert(
      this.state.isPending() && this.type.isActionable(),
      new NotificationCannotBeAnsweredError(),
    );

    this.state = NotificationState.fromDecision(decision);
    this.record({
      aggregateId: this.id.toString(),
      occurredAt: occurredAt.valueOf(),
      type: decision.isAccepted()
        ? NotificationEventType.ACCEPTED.valueOf()
        : NotificationEventType.DECLINED.valueOf(),
    });
  }

  public isRespondable(): boolean {
    return this.state.isPending() && this.type.isActionable();
  }

  public toPrimitives() {
    return {
      id: this.id.toString(),
      recipientIdentityId: this.recipientIdentityId.toString(),
      state: this.state.valueOf(),
      type: this.type.valueOf(),
    };
  }
}
