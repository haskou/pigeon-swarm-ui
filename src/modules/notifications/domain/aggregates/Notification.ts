import { DomainError } from '@haskou/value-objects';

import type { NotificationResource } from '../../../../shared/domain/pigeonResources.types';

import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { NotificationDecision } from '../notificationDecision';
import { NotificationId } from '../NotificationId';
import { NotificationState } from '../notificationState';

export class Notification extends AggregateRoot {
  private constructor(
    private readonly id: NotificationId,
    private state: NotificationState,
    private readonly type: NotificationResource['type'],
  ) {
    super();
  }

  public static fromResource(resource: NotificationResource): Notification {
    return new Notification(
      NotificationId.fromString(resource.id),
      NotificationState.fromPrimitive(resource.state),
      resource.type,
    );
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
    return this.state.isPending() && this.type !== 'missed_call';
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
}
