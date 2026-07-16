export type { SignalSender } from './SignalSender';
export type { DescriptionSignalPayload } from './DescriptionSignalPayload';
import type { DescriptionSignalPayload } from './DescriptionSignalPayload';

export function descriptionPayload(
  description: RTCSessionDescriptionInit,
  screenAudioTrackIds: string[],
  screenAudioStreamIds: string[],
  screenTrackIds: string[],
  screenStreamIds: string[],
  mediaEncryption?: DescriptionSignalPayload['mediaEncryption'],
): Record<string, unknown> {
  return {
    ...(mediaEncryption ? { mediaEncryption } : {}),
    screenAudioStreamIds,
    screenAudioTrackIds,
    screenStreamIds,
    screenTrackIds,
    sdp: description.sdp,
    type: description.type,
  };
}
