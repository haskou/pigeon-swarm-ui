import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

const addMessageReactionAction = 'add';
const removeMessageReactionAction = 'remove';

export type MessageReactionActionPrimitive =
  | typeof addMessageReactionAction
  | typeof removeMessageReactionAction;

export class MessageReactionAction extends StringValueObject {
  private constructor(value: MessageReactionActionPrimitive) {
    super(value);
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

  public isAdd(): boolean {
    return this.isEqual(MessageReactionAction.add());
  }

  public isRemove(): boolean {
    return this.isEqual(MessageReactionAction.remove());
  }

  private static isValid(
    value: string,
  ): value is MessageReactionActionPrimitive {
    return (
      value === addMessageReactionAction ||
      value === removeMessageReactionAction
    );
  }
}
