export class CallResourceRefreshScheduler {
  private readonly pendingRefreshes = new Map<
    string,
    { dirty: boolean; eventType: string }
  >();

  constructor(
    private readonly refresh: (
      callId: string,
      eventType: string,
    ) => Promise<void>,
  ) {}

  request(callId: string, eventType: string): void {
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
        pendingRefresh.dirty = false;
        await this.refresh(callId, pendingRefresh.eventType);
      } while (pendingRefresh.dirty);
    } finally {
      this.pendingRefreshes.delete(callId);
    }
  }
}
