import type { PrimitiveOf } from '@haskou/value-objects';

import { PushApplicationServerKey } from './value-objects/PushApplicationServerKey';

export class PushNotificationServer {
  public static fromPrimitives(
    primitives: PrimitiveOf<PushNotificationServer>,
  ): PushNotificationServer {
    return new PushNotificationServer(
      primitives.enabled,
      PushApplicationServerKey.fromString(primitives.publicKey),
    );
  }

  private constructor(
    private readonly enabled: boolean,
    private readonly publicKey: PushApplicationServerKey,
  ) {}

  public canDeliver(): boolean {
    return this.enabled && !this.publicKey.isEmpty();
  }

  public toPrimitives() {
    return {
      enabled: this.enabled,
      publicKey: this.publicKey.isEmpty()
        ? undefined
        : this.publicKey.toString(),
    };
  }
}
