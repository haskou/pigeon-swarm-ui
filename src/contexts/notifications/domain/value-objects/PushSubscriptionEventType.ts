import { Enum } from '@haskou/value-objects';

enum PushSubscriptionEventTypePrimitive {
  REGISTERED = 'PushSubscriptionRegistered',
  REMOVED = 'PushSubscriptionRemoved',
}

export class PushSubscriptionEventType extends Enum<string> {
  public static readonly REGISTERED = new PushSubscriptionEventType(
    PushSubscriptionEventTypePrimitive.REGISTERED,
  );

  public static readonly REMOVED = new PushSubscriptionEventType(
    PushSubscriptionEventTypePrimitive.REMOVED,
  );

  private constructor(value: string) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(PushSubscriptionEventTypePrimitive);
  }
}
