import { StringValueObject, ValueNotInEnumError } from '@haskou/value-objects';

import type { MessageDeliveryStatePrimitive } from './MessageDeliveryStatePrimitive';

const delivered = 'delivered';
const failed = 'failed';
const pending = 'pending';

export class MessageDeliveryState extends StringValueObject {
  private constructor(value: MessageDeliveryStatePrimitive) {
    super(value);
  }

  public static delivered(): MessageDeliveryState {
    return new MessageDeliveryState(delivered);
  }

  public static failed(): MessageDeliveryState {
    return new MessageDeliveryState(failed);
  }

  public static fromPrimitive(value?: string): MessageDeliveryState {
    if (value === undefined) return MessageDeliveryState.delivered();

    if (value === delivered) return MessageDeliveryState.delivered();

    if (value === failed) return MessageDeliveryState.failed();

    if (value === pending) return MessageDeliveryState.pending();

    throw new ValueNotInEnumError(value, [delivered, failed, pending]);
  }

  public static pending(): MessageDeliveryState {
    return new MessageDeliveryState(pending);
  }

  public isDelivered(): boolean {
    return this.isEqual(MessageDeliveryState.delivered());
  }
}
