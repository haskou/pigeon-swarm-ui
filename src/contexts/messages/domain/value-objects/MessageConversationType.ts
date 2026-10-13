import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['group', 'one-to-one'] as const;

/** Kind of conversation a message lives in; decides where its writes go. */
export class MessageConversationType extends Enum<(typeof values)[number]> {
  public static fromPrimitives(value: string): MessageConversationType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new MessageConversationType(type);
  }

  public static oneToOne(): MessageConversationType {
    return new MessageConversationType('one-to-one');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isOneToOne(): boolean {
    return this.isEqual(MessageConversationType.oneToOne());
  }
}
