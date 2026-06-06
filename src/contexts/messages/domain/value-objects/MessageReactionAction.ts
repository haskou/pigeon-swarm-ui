import type { MessageReactionActionPrimitive } from './MessageReactionActionPrimitive';

export type { MessageReactionActionPrimitive } from './MessageReactionActionPrimitive';
import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

const addMessageReactionAction = 'add';
const removeMessageReactionAction = 'remove';

export class MessageReactionAction extends StringValueObject {
  private static isValid(
    value: string,
  ): value is MessageReactionActionPrimitive {
    return (
      value === addMessageReactionAction ||
      value === removeMessageReactionAction
    );
  }

  public static add(): MessageReactionAction {
    return new MessageReactionAction(addMessageReactionAction);
  }

  public static fromPrimitive(value: string): MessageReactionAction {
    if (!MessageReactionAction.isValid(value)) {
      throw new ValueNotInEnumError(value, [
        addMessageReactionAction,
        removeMessageReactionAction,
      ]);
    }

    return new MessageReactionAction(value);
  }

  public static remove(): MessageReactionAction {
    return new MessageReactionAction(removeMessageReactionAction);
  }

  private constructor(value: MessageReactionActionPrimitive) {
    super(value);
  }

  public isAdd(): boolean {
    return this.isEqual(MessageReactionAction.add());
  }

  public isRemove(): boolean {
    return this.isEqual(MessageReactionAction.remove());
  }
}
