import type { DeliverablePushSubscriptionJson } from './DeliverablePushSubscriptionJson';

export class PushSubscriptionCompatibility {
  private bufferSourceBytes(source: BufferSource): Uint8Array {
    if (source instanceof ArrayBuffer) return new Uint8Array(source);

    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  private serverKeysAreEqual(
    current: BufferSource | null | undefined,
    expected: Uint8Array,
  ): boolean {
    if (!current) return false;

    const currentBytes = this.bufferSourceBytes(current);

    if (currentBytes.byteLength !== expected.byteLength) return false;

    return currentBytes.every((value, index) => value === expected[index]);
  }

  public canReuse(
    subscription: PushSubscription,
    applicationServerKey: Uint8Array,
  ): boolean {
    return (
      this.isDeliverable(subscription.toJSON()) &&
      this.serverKeysAreEqual(
        subscription.options?.applicationServerKey,
        applicationServerKey,
      )
    );
  }

  public isDeliverable(
    subscription: PushSubscriptionJSON,
  ): subscription is DeliverablePushSubscriptionJson {
    return Boolean(
      subscription.endpoint &&
      subscription.keys?.auth &&
      subscription.keys.p256dh,
    );
  }
}
