import { Enum } from '@haskou/value-objects';

enum IdentityPresenceEventTypePrimitive {
  UPDATED = 'IdentityPresenceUpdated',
}

export class IdentityPresenceEventType extends Enum<string> {
  public static readonly UPDATED = new IdentityPresenceEventType(
    IdentityPresenceEventTypePrimitive.UPDATED,
  );

  private constructor(value: IdentityPresenceEventTypePrimitive) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(IdentityPresenceEventTypePrimitive);
  }
}
