import { DomainError } from '@haskou/value-objects';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { NotificationDecision } from '../NotificationDecision';
import { NotificationId } from '../NotificationId';
import { NotificationState } from '../NotificationState';
import { NotificationType } from '../NotificationType';

export class Notification extends AggregateRoot {
  public static fromPrimitives(primitives: {
    id: string;
    state: string;
    type: string;
  }): Notification {
    return new Notification(
      NotificationId.fromString(primitives.id),
      NotificationState.fromPrimitive(primitives.state),
      NotificationType.fromPrimitives(primitives.type),
    );
  }

  private constructor(
    private readonly id: NotificationId,
    private state: NotificationState,
    private readonly type: NotificationType,
  ) {
    super();
  }

  private applyDecision(decision: NotificationDecision): void {
    if (!this.isRespondable() || !this.state.acceptsDecision(decision)) {
      throw new DomainError('Notification cannot be answered.');
    }

    this.state = decision.isAccepted()
      ? NotificationState.accepted()
      : NotificationState.declined();

    this.record({
      aggregateId: this.id.toString(),
      occurredAt: Date.now(),
      type: decision.isAccepted()
        ? 'NotificationAccepted'
        : 'NotificationDeclined',
    });
  }

  public accept(): void {
    this.applyDecision(NotificationDecision.accepted());
  }

  public decline(): void {
    this.applyDecision(NotificationDecision.declined());
  }

  public getId(): NotificationId {
    return this.id;
  }

  public getState(): NotificationState {
    return this.state;
  }

  public isRespondable(): boolean {
    return this.state.isPending() && !this.type.isMissedCall();
  }
}
