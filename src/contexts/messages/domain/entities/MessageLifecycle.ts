import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { MessageDeliveryState } from '../value-objects/MessageDeliveryState';

export class MessageLifecycle {
  public static create(createdAt: Timestamp): MessageLifecycle {
    return new MessageLifecycle(
      MessageDeliveryState.pending(),
      createdAt,
      false,
      false,
    );
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<MessageLifecycle>,
  ): MessageLifecycle {
    return new MessageLifecycle(
      MessageDeliveryState.fromPrimitives(primitives.deliveryState),
      new Timestamp(primitives.createdAt),
      primitives.deleted,
      primitives.pinned,
    );
  }

  private constructor(
    private delivery: MessageDeliveryState,
    private readonly createdAt: Timestamp,
    private deleted: boolean,
    private pinned: boolean,
  ) {}

  public canBeEdited(): boolean {
    return this.delivery.isDelivered() && !this.deleted;
  }

  public delete(): boolean {
    if (this.deleted) return false;

    this.deleted = true;

    return true;
  }

  public deliver(): void {
    this.delivery = MessageDeliveryState.delivered();
  }

  public pin(): boolean {
    if (this.pinned) return false;

    this.pinned = true;

    return true;
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      deleted: this.deleted,
      deliveryState: this.delivery.valueOf(),
      pinned: this.pinned,
    };
  }

  public unpin(): boolean {
    if (!this.pinned) return false;

    this.pinned = false;

    return true;
  }
}
