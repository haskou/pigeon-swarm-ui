import type { CallParticipantStatus } from '../../infrastructure/http/resources/CallParticipantStatus';
import type { CallResource } from '../../infrastructure/http/resources/CallResource';

/** Statuses that end a participant's place in the call, whatever its lease. */
const releasedStatuses: ReadonlySet<CallParticipantStatus> = new Set([
  'declined',
  'left',
  'missed',
]);

export function joinedRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => participant.connected)
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function participantJoinWasAccepted(
  call: CallResource,
  identityId: string,
): boolean {
  return call.participants.some(
    (participant) =>
      participant.identityId === identityId && participant.status === 'joined',
  );
}

export function releasedRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => releasedStatuses.has(participant.status))
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function signalingRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => participant.connected)
    .filter((participant) => !releasedStatuses.has(participant.status))
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function retainedRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => !releasedStatuses.has(participant.status))
    .filter(
      (participant) => participant.connected || participant.status === 'joined',
    )
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function shouldCreateInitialOffer(
  call: CallResource,
  currentIdentityId: string,
  peerIdentityId: string,
): boolean {
  return (
    call.participantIds.includes(currentIdentityId) &&
    call.participantIds.includes(peerIdentityId) &&
    currentIdentityId < peerIdentityId
  );
}
