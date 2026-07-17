import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['add', 'remove'] as const;

export class MessageReactionAction extends Enum<(typeof values)[number]> {
  public static add(): MessageReactionAction {
    return new MessageReactionAction('add');
  }

  public static fromPrimitives(value: string): MessageReactionAction {
    const action = values.find((candidate) => candidate === value);

    if (!action) throw new ValueNotInEnumError(value, values);

    return new MessageReactionAction(action);
  }

  public static remove(): MessageReactionAction {
    return new MessageReactionAction('remove');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isAdd(): boolean {
    return this.isEqual(MessageReactionAction.add());
  }

  public isRemove(): boolean {
    return this.isEqual(MessageReactionAction.remove());
  }
}
