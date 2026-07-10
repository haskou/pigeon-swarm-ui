import type { CallSignalDeliveryInput } from './CallSignalDeliveryInput';

export class CallSignalDeliveryTracker {
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

    await apply();

    this.processed.set(input.signalId, input.expiresAt);
    this.trimToLimit();
    acknowledge();
  }
}
