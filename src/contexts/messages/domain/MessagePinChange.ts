import { Timestamp } from '@haskou/value-objects';

import { MessageId } from './value-objects/MessageId';
import { MessagePinAction } from './value-objects/MessagePinAction';

/** One pin or unpin of a message, stamped with when its author made it. */
export class MessagePinChange {
  private static readonly MAX_FUTURE_SKEW_MS = 30_000;

  public static create(
    action: MessagePinAction,
    messageId: MessageId,
    createdAt: Timestamp,
  ): MessagePinChange {
    return new MessagePinChange(action, createdAt, messageId);
  }

  /** A pin or unpin made now. */
  public static now(
    action: MessagePinAction,
    messageId: MessageId,
  ): MessagePinChange {
    return new MessagePinChange(action, Timestamp.now(), messageId);
  }

  public static fromPrimitives(primitives: {
    action: string;
    createdAt: number;
    messageId: string;
  }): MessagePinChange {
    return new MessagePinChange(
      MessagePinAction.fromPrimitives(primitives.action),
      new Timestamp(primitives.createdAt),
      MessageId.fromString(primitives.messageId),
    );
  }

  private constructor(
    private readonly action: MessagePinAction,
    private readonly createdAt: Timestamp,
    private readonly messageId: MessageId,
  ) {}

  public getAction(): MessagePinAction {
    return this.action;
  }

  public getCreatedAt(): Timestamp {
    return this.createdAt;
  }

  public getMessageId(): MessageId {
    return this.messageId;
  }

  /**
   * Returns this change with its author-chosen createdAt held to at most 30 s
   * after the time it was received, so a peer cannot date a change far ahead
   * and win every later change. Older dates stay as they are, so late
   * deliveries keep their order.
   */
  public clampedTo(receivedAt: Timestamp): MessagePinChange {
    const createdAt = Math.min(
      this.createdAt.valueOf(),
      receivedAt.valueOf() + MessagePinChange.MAX_FUTURE_SKEW_MS,
    );

    return createdAt === this.createdAt.valueOf()
      ? this
      : new MessagePinChange(
          this.action,
          new Timestamp(createdAt),
          this.messageId,
        );
  }
}
