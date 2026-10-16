import type { CallMediaTrack } from './CallMediaTrack';
import type { CallMediaTransformOptions } from './CallMediaTransformOptions';

import {
  isScreenShareAudioTrack,
  isScreenShareTrack,
} from './callMediaTrackClassification';

const tracks: readonly CallMediaTrack[] = [
  'audio',
  'screen-audio',
  'screen-video',
  'video',
];

/** The track a local `track` sends its frames on. */
export function callMediaTrackOf(track: MediaStreamTrack): CallMediaTrack {
  if (isScreenShareAudioTrack(track)) return 'screen-audio';

  if (track.kind === 'audio') return 'audio';

  return isScreenShareTrack(track) ? 'screen-video' : 'video';
}

/** The options of a call media transform, if `options` are valid ones. */
export function callMediaTransformOptionsOf(
  options: unknown,
): CallMediaTransformOptions | null {
  if (typeof options !== 'object' || options === null) return null;

  const { senderId, side, track } = options as Record<string, unknown>;

  if (
    (side !== 'receive' && side !== 'send') ||
    typeof senderId !== 'string' ||
    senderId.length === 0 ||
    !tracks.includes(track as CallMediaTrack)
  )
    return null;

  return { senderId, side, track: track as CallMediaTrack };
}
