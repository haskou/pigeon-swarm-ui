import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = ['delivered', 'failed', 'pending'] as const;

export class MessageDeliveryState extends Enum<(typeof values)[number]> {
  public static delivered(): MessageDeliveryState {
    return new MessageDeliveryState('delivered');
  }

  public static failed(): MessageDeliveryState {
    return new MessageDeliveryState('failed');
  }

  public static fromPrimitives(value = 'delivered'): MessageDeliveryState {
    const state = values.find((candidate) => candidate === value);

    if (!state) throw new ValueNotInEnumError(value, values);

    return new MessageDeliveryState(state);
  }

  public static pending(): MessageDeliveryState {
    return new MessageDeliveryState('pending');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isDelivered(): boolean {
    return this.isEqual(MessageDeliveryState.delivered());
  }
}
