import type { CallResource } from '../../domain/callSession.types';

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

export function signalingRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => participant.connected)
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function retainedRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter(
      (participant) =>
        participant.connected || participant.status === 'joined',
    )
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function shouldCreateInitialOffer(
  currentIdentityId: string,
  peerIdentityId: string,
): boolean {
  return currentIdentityId < peerIdentityId;
}
