type CallHeartbeatLoopInput = {
  callId: string;
  failureLimit?: number;
  heartbeat: (callId: string) => Promise<void>;
  intervalMs?: number;
  onFailureLimit: () => void;
};

export function startCallHeartbeatLoop({
  callId,
  failureLimit = 3,
  heartbeat,
  intervalMs = 2000,
  onFailureLimit,
}: CallHeartbeatLoopInput): () => void {
  let failedHeartbeats = 0;
  let heartbeatInFlight = false;
  let stopped = false;

  const sendHeartbeat = () => {
    if (stopped || heartbeatInFlight) return;

    heartbeatInFlight = true;
    void heartbeat(callId)
      .then(() => {
        failedHeartbeats = 0;
      })
      .catch(() => {
        failedHeartbeats += 1;

        if (failedHeartbeats >= failureLimit) {
          stopped = true;
          clearInterval(interval);
          onFailureLimit();
        }
      })
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
