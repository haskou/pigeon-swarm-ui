type CallHeartbeatLoopInput = {
  callId: string;
  heartbeat: (callId: string) => Promise<void>;
  intervalMs?: number;
};

export function startCallHeartbeatLoop({
  callId,
  heartbeat,
  intervalMs = 2000,
}: CallHeartbeatLoopInput): () => void {
  let nextHeartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const scheduleHeartbeat = (delay: number): void => {
    if (stopped) return;

    nextHeartbeatTimer = setTimeout(sendHeartbeat, delay);
  };
  const sendHeartbeat = (): void => {
    if (stopped) return;

    const startedAt = Date.now();
    void heartbeat(callId)
      .catch(() => undefined)
      .finally(() => {
        const elapsed = Date.now() - startedAt;

        scheduleHeartbeat(Math.max(0, intervalMs - elapsed));
      });
  };

  sendHeartbeat();

  return () => {
    stopped = true;

    if (nextHeartbeatTimer !== undefined) {
      clearTimeout(nextHeartbeatTimer);
    }
  };
}
