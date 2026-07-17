import { Enum, assert } from '@haskou/value-objects';

import { DisconnectedIdentityPresenceSelectionError } from '../errors/DisconnectedIdentityPresenceSelectionError';

enum IdentityPresenceStatusPrimitive {
  AVAILABLE = 'available',
  AWAY = 'away',
  BUSY = 'busy',
  DISCONNECTED = 'disconnected',
  INVISIBLE = 'invisible',
}

export class IdentityPresenceStatus extends Enum<string> {
  public static readonly AVAILABLE = new IdentityPresenceStatus(
    IdentityPresenceStatusPrimitive.AVAILABLE,
  );

  public static readonly AWAY = new IdentityPresenceStatus(
    IdentityPresenceStatusPrimitive.AWAY,
  );

  public static readonly BUSY = new IdentityPresenceStatus(
    IdentityPresenceStatusPrimitive.BUSY,
  );

  public static readonly DISCONNECTED = new IdentityPresenceStatus(
    IdentityPresenceStatusPrimitive.DISCONNECTED,
  );

  public static readonly INVISIBLE = new IdentityPresenceStatus(
    IdentityPresenceStatusPrimitive.INVISIBLE,
  );

  public static fromPrimitives(value: string): IdentityPresenceStatus {
    return new IdentityPresenceStatus(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public assertSelectable(): void {
    assert(
      !this.isEqual(IdentityPresenceStatus.DISCONNECTED),
      new DisconnectedIdentityPresenceSelectionError(),
    );
  }

  public getValues(): string[] {
    return Object.values(IdentityPresenceStatusPrimitive);
  }
}
