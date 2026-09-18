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

  public request(callId: string, eventType: string): void {
    const pendingRefresh = this.pendingRefreshes.get(callId);

    if (pendingRefresh) {
      pendingRefresh.dirty = true;
      pendingRefresh.eventType = eventType;

      return;
    }

    const refresh = { dirty: false, eventType };
    this.pendingRefreshes.set(callId, refresh);
    void this.drain(callId, refresh);
  }

  private async drain(
    callId: string,
    pendingRefresh: { dirty: boolean; eventType: string },
  ): Promise<void> {
    try {
      do {
        const delay = Math.max(
          0,
          1000 - (Date.now() - (this.lastRefreshAt.get(callId) ?? 0)),
        );

        if (delay > 0)
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        pendingRefresh.dirty = false;
        this.lastRefreshAt.set(callId, Date.now());
        await this.refresh(callId, pendingRefresh.eventType);
      } while (pendingRefresh.dirty);
    } finally {
      this.pendingRefreshes.delete(callId);
    }
  }
}
