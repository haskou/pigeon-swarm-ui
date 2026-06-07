export type { SignalSender } from './SignalSender';
export type { DescriptionSignalPayload } from './DescriptionSignalPayload';

export function descriptionPayload(
  description: RTCSessionDescriptionInit,
  screenAudioTrackIds: string[],
  screenAudioStreamIds: string[],
  screenTrackIds: string[],
  screenStreamIds: string[],
): Record<string, unknown> {
  return {
    screenAudioStreamIds,
    screenAudioTrackIds,
    screenStreamIds,
    screenTrackIds,
    sdp: description.sdp,
    type: description.type,
  };
}
