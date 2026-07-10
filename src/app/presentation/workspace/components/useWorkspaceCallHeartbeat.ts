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
};

export function useWorkspaceCallHeartbeat({
  activeCall,
  heartbeat,
  mediaConnections,
}: WorkspaceCallHeartbeatInput): void {
  const heartbeatRef = useRef(heartbeat);
  const mediaConnectionsRef = useRef(mediaConnections);

  useEffect(() => {
    heartbeatRef.current = heartbeat;
    mediaConnectionsRef.current = mediaConnections;
  }, [heartbeat, mediaConnections]);

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
    });
  }, [activeCall?.id, activeCall?.status]);
}
