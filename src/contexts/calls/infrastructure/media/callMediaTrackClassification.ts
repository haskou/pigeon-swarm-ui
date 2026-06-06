export function isScreenShareTrack(track: MediaStreamTrack): boolean {
  return track.kind === 'video' && track.contentHint === 'detail';
}

export function isScreenShareAudioTrack(track: MediaStreamTrack): boolean {
  return track.kind === 'audio' && track.contentHint === 'music';
}

function localTrackSlot(
  track: MediaStreamTrack,
): 'camera' | 'microphone' | 'screen' | 'screen-audio' {
  if (isScreenShareAudioTrack(track)) return 'screen-audio';

  if (track.kind === 'audio') return 'microphone';

  return isScreenShareTrack(track) ? 'screen' : 'camera';
}

export function replacementLocalTrack(
  currentTrack: MediaStreamTrack,
  activeTracks: MediaStreamTrack[],
): MediaStreamTrack | undefined {
  const slot = localTrackSlot(currentTrack);

  return activeTracks.find((track) => localTrackSlot(track) === slot);
}

export function isRemoteScreenShareTrack(
  track: MediaStreamTrack,
  streams: readonly MediaStream[],
  remoteScreenTrackIds: Set<string>,
  remoteScreenStreamIds: Set<string>,
): boolean {
  if (track.kind !== 'video') return false;

  if (remoteScreenTrackIds.has(track.id)) return true;

  if (streams.some((stream) => remoteScreenStreamIds.has(stream.id))) {
    return true;
  }

  if (isScreenShareTrack(track)) return true;

  return /screen|display|window|tab|monitor/i.test(track.label);
}

export function isRemoteScreenShareAudioTrack(
  track: MediaStreamTrack,
  streams: readonly MediaStream[],
  remoteScreenAudioTrackIds: Set<string>,
  remoteScreenAudioStreamIds: Set<string>,
): boolean {
  if (track.kind !== 'audio') return false;

  if (remoteScreenAudioTrackIds.has(track.id)) return true;

  if (streams.some((stream) => remoteScreenAudioStreamIds.has(stream.id))) {
    return true;
  }

  return isScreenShareAudioTrack(track);
}

export function hasAudioTrack(
  track: MediaStreamTrack,
  stream: MediaStream,
): boolean {
  return track.kind === 'audio' || stream.getAudioTracks().length > 0;
}
