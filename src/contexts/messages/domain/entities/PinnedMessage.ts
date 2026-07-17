import { Timestamp, type PrimitiveOf } from '@haskou/value-objects';

import { Message } from '../Message';
import { MessageAuthorId } from '../value-objects/MessageAuthorId';
import { MessageId } from '../value-objects/MessageId';

export class PinnedMessage {
  public static fromPrimitives(
    primitives: PrimitiveOf<PinnedMessage>,
  ): PinnedMessage {
    return new PinnedMessage(
      MessageId.fromString(primitives.messageId),
      MessageAuthorId.fromString(primitives.pinnedByIdentityId),
      new Timestamp(primitives.createdAt),
      Message.fromPrimitives(primitives.message),
    );
  }

  private constructor(
    private readonly messageId: MessageId,
    private readonly pinnedByIdentityId: MessageAuthorId,
    private readonly createdAt: Timestamp,
    private readonly message: Message,
  ) {}

  public getMessage(): Message {
    return this.message;
  }

  public toPrimitives() {
    return {
      createdAt: this.createdAt.valueOf(),
      message: this.message.toPrimitives(),
      messageId: this.messageId.toString(),
      pinnedByIdentityId: this.pinnedByIdentityId.toString(),
    };
  }
}
