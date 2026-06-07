import type { CallParticipantStatus } from './CallParticipantStatus';

export type CallResourceParticipant = {
  declinedAt?: number;
  identityId: string;
  joinedAt?: number;
  leftAt?: number;
  missedAt?: number;
  status: CallParticipantStatus;
};
