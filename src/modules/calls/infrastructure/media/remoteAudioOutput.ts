export function nativeAudioVolume(volume: number): number {
  return Math.min(1, volume);
}

export function graphAudioVolume(volume: number, deafened: boolean): number {
  return deafened ? 0 : volume;
}

export function needsAudioGraph(volume: number): boolean {
  return volume > 1;
}

export function isMediaStreamSource(
  source: MediaProvider | null,
): source is MediaStream {
  return Boolean(source && 'getAudioTracks' in source);
}

export function remoteAudioKey(
  peerIdentityId: string,
  channel: 'screen' | 'voice',
): string {
  return channel === 'voice' ? peerIdentityId : `${peerIdentityId}:screen`;
}
