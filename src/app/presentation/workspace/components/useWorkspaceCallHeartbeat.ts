import { useEffect, useRef } from 'react';

import type { CallParticipantMediaConnectionResource as CallParticipantMediaConnection } from '../../../../contexts/calls/infrastructure/http/resources/CallParticipantMediaConnectionResource';
import type { CallSession } from '../../../../contexts/calls/presentation/view-models/CallSession';

import { logCallWarning } from '../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { startCallHeartbeatLoop } from './startCallHeartbeatLoop';

type WorkspaceCallHeartbeatInput = {
  activeCall: Pick<CallSession, 'id' | 'status'> | null;
  heartbeat: (
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ) => Promise<void>;
  mediaConnections: () => CallParticipantMediaConnection[];
  onAccessDenied: (callId: string) => void;
};

export function useWorkspaceCallHeartbeat({
  activeCall,
  heartbeat,
  mediaConnections,
  onAccessDenied,
}: WorkspaceCallHeartbeatInput): void {
  const accessDeniedRef = useRef(onAccessDenied);
  const heartbeatRef = useRef(heartbeat);
  const mediaConnectionsRef = useRef(mediaConnections);

  useEffect(() => {
    accessDeniedRef.current = onAccessDenied;
    heartbeatRef.current = heartbeat;
    mediaConnectionsRef.current = mediaConnections;
  }, [heartbeat, mediaConnections, onAccessDenied]);

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
      onAccessDenied: (callId) => accessDeniedRef.current(callId),
    });
  }, [activeCall?.id, activeCall?.status]);
}
