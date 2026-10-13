import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['pin', 'unpin'] as const;

export class MessagePinAction extends Enum<(typeof values)[number]> {
  public static fromPrimitives(value: string): MessagePinAction {
    const action = values.find((candidate) => candidate === value);

    if (!action) throw new ValueNotInEnumError(value, values);

    return new MessagePinAction(action);
  }

  public static pin(): MessagePinAction {
    return new MessagePinAction('pin');
  }

  public static unpin(): MessagePinAction {
    return new MessagePinAction('unpin');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isPin(): boolean {
    return this.isEqual(MessagePinAction.pin());
  }
}
