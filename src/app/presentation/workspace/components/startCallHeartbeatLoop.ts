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
  let heartbeatInFlight = false;
  let stopped = false;

  const sendHeartbeat = () => {
    if (stopped || heartbeatInFlight) return;

    heartbeatInFlight = true;
    void heartbeat(callId)
      .catch(() => undefined)
      .finally(() => {
        heartbeatInFlight = false;
      });
  };

  sendHeartbeat();
  const interval = setInterval(sendHeartbeat, intervalMs);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
