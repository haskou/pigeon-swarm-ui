import { useEffect } from 'react';

import type { CallSession } from '../../../../contexts/calls/domain/callSession.types';

import { logCallWarning } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';

type WorkspaceCallHeartbeatInput = {
  activeCall: Pick<CallSession, 'id' | 'status'> | null;
  heartbeat: (callId: string) => Promise<void>;
  onHeartbeatFailureLimit: () => void;
};

export function useWorkspaceCallHeartbeat({
  activeCall,
  heartbeat,
  onHeartbeatFailureLimit,
}: WorkspaceCallHeartbeatInput): void {
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'live') return undefined;

    let failedHeartbeats = 0;
    let stopped = false;

    const sendHeartbeat = () => {
      void heartbeat(activeCall.id)
        .then(() => {
          failedHeartbeats = 0;
        })
        .catch((caught) => {
          failedHeartbeats += 1;
          logCallWarning('workspace:call-heartbeat:failed', {
            callId: activeCall.id,
            error: caught,
            failedHeartbeats,
          });

          if (!stopped && failedHeartbeats >= 3) {
            stopped = true;
            onHeartbeatFailureLimit();
          }
        });
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 2000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [activeCall?.id, activeCall?.status, heartbeat, onHeartbeatFailureLimit]);
}
