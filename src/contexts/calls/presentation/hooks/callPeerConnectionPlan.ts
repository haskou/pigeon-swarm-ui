import type { CallResource } from '../../domain/callSession.types';

export function joinedRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) => participant.status === 'joined')
    .filter((participant) => participant.identityId !== currentIdentityId)
    .map((participant) => participant.identityId);
}

export function signalingRemotePeerIdentityIds(
  call: CallResource,
  currentIdentityId: string,
): string[] {
  return call.participants
    .filter((participant) =>
      participant.status === 'joined' || participant.status === 'ringing',
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
