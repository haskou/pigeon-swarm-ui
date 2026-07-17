import type { CallParticipant } from '../view-models/CallParticipant';

export function callParticipantHasActiveScreenShare(
  participant: CallParticipant,
): boolean {
  return Boolean(
    participant.screenSharing &&
    participant.screenStream
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live' && !track.muted),
  );
}
