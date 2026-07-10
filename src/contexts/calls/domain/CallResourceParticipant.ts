import type { CallParticipantMediaConnection } from './CallParticipantMediaConnection';
import type { CallParticipantStatus } from './CallParticipantStatus';

export type CallResourceParticipant = {
  connected: boolean;
  declinedAt?: number;
  identityId: string;
  joinedAt?: number;
  lastHeartbeatAt?: number;
  leftAt?: number;
  mediaConnections: CallParticipantMediaConnection[];
  missedAt?: number;
  status: CallParticipantStatus;
};
