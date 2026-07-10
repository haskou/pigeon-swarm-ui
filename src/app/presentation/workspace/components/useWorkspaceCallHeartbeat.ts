import { useEffect, useRef } from 'react';

import type { CallSession } from '../../../../contexts/calls/domain/callSession.types';
import type { CallParticipantMediaConnection } from '../../../../contexts/calls/domain/callSession.types';

import { logCallWarning } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { startCallHeartbeatLoop } from './startCallHeartbeatLoop';

type WorkspaceCallHeartbeatInput = {
  activeCall: Pick<CallSession, 'id' | 'status'> | null;
  heartbeat: (
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ) => Promise<void>;
  mediaConnections: () => CallParticipantMediaConnection[];
  onHeartbeatFailureLimit: () => void;
};

export function useWorkspaceCallHeartbeat({
  activeCall,
  heartbeat,
  mediaConnections,
  onHeartbeatFailureLimit,
}: WorkspaceCallHeartbeatInput): void {
  const heartbeatRef = useRef(heartbeat);
  const mediaConnectionsRef = useRef(mediaConnections);
  const onHeartbeatFailureLimitRef = useRef(onHeartbeatFailureLimit);

  useEffect(() => {
    heartbeatRef.current = heartbeat;
    mediaConnectionsRef.current = mediaConnections;
    onHeartbeatFailureLimitRef.current = onHeartbeatFailureLimit;
  }, [heartbeat, mediaConnections, onHeartbeatFailureLimit]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'live') return undefined;

    return startCallHeartbeatLoop({
      callId: activeCall.id,
      heartbeat: async (callId) => {
        try {
          await heartbeatRef.current(callId, mediaConnectionsRef.current());
        } catch (caught) {
          logCallWarning('workspace:call-heartbeat:failed', {
            callId,
            error: caught,
          });
          throw caught;
        }
      },
      onFailureLimit: () => onHeartbeatFailureLimitRef.current(),
    });
  }, [activeCall?.id, activeCall?.status]);
}
