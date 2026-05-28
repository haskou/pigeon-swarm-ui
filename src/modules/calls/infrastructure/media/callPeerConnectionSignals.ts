import type { CallSignalType } from '../../domain/callSession.types';

export type SignalSender = (
  recipientIdentityId: string,
  signalType: CallSignalType,
  payload: Record<string, unknown>,
) => Promise<void>;

export type DescriptionSignalPayload = RTCSessionDescriptionInit & {
  screenAudioStreamIds?: string[];
  screenAudioTrackIds?: string[];
  screenStreamIds?: string[];
  screenTrackIds?: string[];
};

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
