import type { CallParticipant } from './CallParticipant';
import type { CallSession } from './CallSession';

export type CallParticipantConnectionQuality =
  | 'connecting'
  | 'disconnected'
  | 'good'
  | 'poor'
  | 'weak';

const connectingStatuses = new Set([
  'checking',
  'connecting',
  'incoming',
  'joined',
  'new',
  'reconnecting',
  'ringing',
]);
const disconnectedStatuses = new Set([
  'closed',
  'declined',
  'disconnected',
  'ended',
  'failed',
  'left',
  'missed',
]);

export function callParticipantConnectionStatus(
  participant: CallParticipant,
  call: CallSession,
): string {
  if (participant.connected === false) return 'disconnected';

  if (participant.identityId === call.currentIdentityId) return call.status;

  if (participant.connectionState) return participant.connectionState;

  if (participant.iceState) return participant.iceState;

  if (participant.status) return participant.status;

  return call.status;
}

export function callParticipantConnectionQuality(
  participant: CallParticipant,
  call: CallSession,
): CallParticipantConnectionQuality {
  const status = callParticipantConnectionStatus(participant, call);

  if (connectingStatuses.has(status)) return 'connecting';

  if (disconnectedStatuses.has(status)) return 'disconnected';

  return establishedConnectionQuality(participant);
}

function establishedConnectionQuality(
  participant: CallParticipant,
): CallParticipantConnectionQuality {
  const packetsLost = participant.packetsLost ?? 0;

  if (packetsLost >= 20) return 'poor';

  if (connectionIsWeak(participant.latencyMs ?? 0, packetsLost)) {
    return 'weak';
  }

  return 'good';
}

function connectionIsWeak(latencyMs: number, packetsLost: number): boolean {
  return latencyMs > 250 || packetsLost > 3;
}
