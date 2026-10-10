import type { CallParticipant } from './CallParticipant';

export type CallAudioConnectionState =
  | 'connecting'
  | 'failed'
  | 'reconnecting'
  | 'relayed';

/**
 * Summarises the audio path to the remote participants for the call header.
 * Returns undefined when there is nothing worth telling the user.
 */
export function callAudioConnectionState(
  participants: CallParticipant[],
  currentIdentityId: string,
): CallAudioConnectionState | undefined {
  const remote = participants.filter(
    (participant) =>
      participant.identityId !== currentIdentityId &&
      participant.status !== 'declined' &&
      participant.status !== 'left' &&
      participant.status !== 'missed',
  );

  if (remote.some((participant) => participant.recoveryState === 'exhausted'))
    return 'failed';

  if (remote.some((participant) => participant.recoveryState === 'recovering'))
    return 'reconnecting';

  const established = remote.filter(
    (participant) =>
      participant.connectionState === 'connected' ||
      participant.iceState === 'connected' ||
      participant.iceState === 'completed',
  );

  if (established.length === 0) {
    const pending = remote.some(
      (participant) =>
        participant.connectionState === 'new' ||
        participant.connectionState === 'connecting' ||
        participant.iceState === 'new' ||
        participant.iceState === 'checking',
    );

    return pending ? 'connecting' : undefined;
  }

  return established.every(
    (participant) => participant.connectionPath === 'relay',
  )
    ? 'relayed'
    : undefined;
}
