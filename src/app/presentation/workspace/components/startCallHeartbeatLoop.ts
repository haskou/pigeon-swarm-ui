import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';

type CallHeartbeatLoopInput = {
  callId: string;
  heartbeat: (callId: string) => Promise<void>;
  intervalMs?: number;
  onAccessDenied?: (callId: string) => void;
};

export function startCallHeartbeatLoop({
  callId,
  heartbeat,
  intervalMs = 2000,
  onAccessDenied,
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
      .catch((caught: unknown) => {
        if (stopped || !(caught instanceof HttpJsonError)) return;

        if (
          ![401, 403, 404].includes(caught.status) &&
          !(caught.status === 409 && caught.code === 'CallNotFoundError')
        )
          return;
        stopped = true;
        onAccessDenied?.(callId);
      })
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
