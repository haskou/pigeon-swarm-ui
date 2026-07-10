import type { CallSignalDeliveryInput } from './CallSignalDeliveryInput';

export class CallSignalDeliveryTracker {
  private readonly inFlight = new Map<string, Promise<void>>();

  private readonly processed = new Map<string, number>();

  public constructor(private readonly maximumEntries = 512) {}

  private removeExpired(now: number): void {
    for (const [signalId, expiresAt] of this.processed) {
      if (expiresAt <= now) this.processed.delete(signalId);
    }
  }

  private trimToLimit(): void {
    while (this.processed.size > this.maximumEntries) {
      const oldestSignalId = this.processed.keys().next().value;

      if (typeof oldestSignalId !== 'string') return;
      this.processed.delete(oldestSignalId);
    }
  }

  public async receive(
    input: CallSignalDeliveryInput,
    apply: () => Promise<void>,
    acknowledge: () => void,
    now = Date.now(),
  ): Promise<void> {
    this.removeExpired(now);

    if (input.expiresAt <= now) return;

    if (this.processed.has(input.signalId)) {
      acknowledge();

      return;
    }

    const currentDelivery = this.inFlight.get(input.signalId);

    if (currentDelivery) {
      await currentDelivery;
      acknowledge();

      return;
    }

    const delivery = apply();

    this.inFlight.set(input.signalId, delivery);

    try {
      await delivery;

      this.processed.set(input.signalId, input.expiresAt);
      this.trimToLimit();
      acknowledge();
    } finally {
      this.inFlight.delete(input.signalId);
    }
  }
}
