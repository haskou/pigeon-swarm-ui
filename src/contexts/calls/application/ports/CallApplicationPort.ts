import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type {
  CallIceServerConfig,
  CallParticipantMediaConnection,
  CallResource,
  CallSignalDelivery,
  CallSignalPayload,
} from '../../domain/callSession.types';

export interface CallApplicationPort {
  list(session: Session): Promise<CallResource[]>;
  get(session: Session, callId: string): Promise<CallResource>;
  getIceServers(session: Session): Promise<CallIceServerConfig>;
  startConversation(
    session: Session,
    conversationId: string,
  ): Promise<CallResource>;
  startCommunityChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CallResource>;
  join(session: Session, callId: string): Promise<CallResource>;
  leave(session: Session, callId: string): Promise<void>;
  heartbeat(
    session: Session,
    callId: string,
    mediaConnections: CallParticipantMediaConnection[],
  ): Promise<CallResource>;
  end(session: Session, callId: string): Promise<void>;
  sendSignal(
    session: Session,
    callId: string,
    signal: CallSignalPayload,
  ): Promise<CallSignalDelivery>;
}
