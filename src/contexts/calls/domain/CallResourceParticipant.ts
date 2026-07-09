import type { CallParticipantStatus } from './CallParticipantStatus';

export type CallResourceParticipant = {
  connected: boolean;
  declinedAt?: number;
  identityId: string;
  joinedAt?: number;
  lastHeartbeatAt?: number;
  leftAt?: number;
  missedAt?: number;
  status: CallParticipantStatus;
};
