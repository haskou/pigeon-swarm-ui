import type { CallResourceParticipant } from './CallResourceParticipant';
import type { CallScope } from './CallScope';

export type CallResource = {
  createdAt: number;
  creatorIdentityId: string;
  endedAt?: number;
  id: string;
  networkId: string;
  participantIds: string[];
  participants: CallResourceParticipant[];
  scope: CallScope;
  status: 'active' | 'ended' | 'missed';
};
