import { Enum } from '@haskou/value-objects';

enum IdentityEventTypePrimitive {
  CREATED = 'IdentityCreated',
  PROFILE_UPDATED = 'IdentityProfileUpdated',
}

export class IdentityEventType extends Enum<string> {
  public static readonly CREATED = new IdentityEventType(
    IdentityEventTypePrimitive.CREATED,
  );

  public static readonly PROFILE_UPDATED = new IdentityEventType(
    IdentityEventTypePrimitive.PROFILE_UPDATED,
  );

  private constructor(value: IdentityEventTypePrimitive) {
    super(value);
  }

  public getValues(): string[] {
    return Object.values(IdentityEventTypePrimitive);
  }
}
