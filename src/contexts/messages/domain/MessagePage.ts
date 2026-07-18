import type { Message } from './Message';
import type { MessageId } from './value-objects/MessageId';

export class MessagePage {
  public static create(
    messages: Message[],
    nextCursor?: MessageId,
    previousCursor?: MessageId,
  ): MessagePage {
    return new MessagePage([...messages], nextCursor, previousCursor);
  }

  private constructor(
    private readonly messages: Message[],
    private readonly nextCursor?: MessageId,
    private readonly previousCursor?: MessageId,
  ) {}

  public mapMessages<Result>(mapper: (message: Message) => Result): Result[] {
    return this.messages.map(mapper);
  }

  public getNextCursor(): MessageId | undefined {
    return this.nextCursor;
  }

  public getPreviousCursor(): MessageId | undefined {
    return this.previousCursor;
  }
}
