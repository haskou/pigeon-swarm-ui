export class CallResourceRefreshScheduler {
  private readonly pendingRefreshes = new Map<
    string,
    { dirty: boolean; eventType: string }
  >();

  private readonly lastRefreshAt = new Map<string, number>();

  public constructor(
    private readonly refresh: (
      callId: string,
      eventType: string,
    ) => Promise<void>,
  ) {}

  private async drain(callId: string): Promise<void> {
    // request() stores this entry before draining. It stays in the map until
    // the finally block below, so the lookup cannot miss.
    const pendingRefresh = this.pendingRefreshes.get(callId)!;

    try {
      do {
        const delay = Math.max(
          0,
          1000 - (Date.now() - (this.lastRefreshAt.get(callId) ?? 0)),
        );

        if (delay > 0)
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        // request() sets dirty on this same map entry to queue a re-run.
        pendingRefresh.dirty = false;
        this.lastRefreshAt.set(callId, Date.now());
        await this.refresh(callId, pendingRefresh.eventType);
      } while (pendingRefresh.dirty);
    } finally {
      this.pendingRefreshes.delete(callId);
    }
  }

  public request(callId: string, eventType: string): void {
    const pendingRefresh = this.pendingRefreshes.get(callId);

    if (pendingRefresh) {
      pendingRefresh.dirty = true;
      pendingRefresh.eventType = eventType;

      return;
    }

    this.pendingRefreshes.set(callId, { dirty: false, eventType });
    void this.drain(callId);
  }
}
