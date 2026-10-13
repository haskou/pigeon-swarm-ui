import { Timestamp } from '@haskou/value-objects';

import { MessageId } from './value-objects/MessageId';
import { MessagePinAction } from './value-objects/MessagePinAction';

/** One pin or unpin of a message, stamped with when its author made it. */
export class MessagePinChange {
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
}
