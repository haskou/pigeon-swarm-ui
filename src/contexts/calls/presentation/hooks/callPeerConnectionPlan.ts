import type { CallResource } from '../../infrastructure/http/resources/CallResource';

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
  const currentParticipant = call.participants.find(
    (participant) => participant.identityId === currentIdentityId,
  );
  const peerParticipant = call.participants.find(
    (participant) => participant.identityId === peerIdentityId,
  );
  const currentJoinedAt = currentParticipant?.joinedAt;
  const peerJoinedAt = peerParticipant?.joinedAt;

  if (
    currentJoinedAt !== undefined &&
    peerJoinedAt !== undefined &&
    currentJoinedAt !== peerJoinedAt
  ) {
    return currentJoinedAt > peerJoinedAt;
  }

  return currentIdentityId < peerIdentityId;
}
