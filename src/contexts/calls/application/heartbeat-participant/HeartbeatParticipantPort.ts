import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type {
  CallParticipantMediaConnection,
  CallResource,
} from '../../domain/callSession.types';

export interface HeartbeatParticipantPort {
  heartbeat(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ): Promise<CallResource>;
}
