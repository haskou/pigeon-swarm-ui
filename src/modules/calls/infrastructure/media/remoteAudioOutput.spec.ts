import {
  graphAudioVolume,
  isMediaStreamSource,
  nativeAudioVolume,
  needsAudioGraph,
  remoteAudioKey,
} from './remoteAudioOutput';

describe('remote audio output', () => {
  it('keeps native media element volume capped at browser limits', () => {
    expect(nativeAudioVolume(0.5)).toBe(0.5);
    expect(nativeAudioVolume(2.5)).toBe(1);
  });

  it('uses the audio graph for boosted volumes and mutes it when deafened', () => {
    expect(needsAudioGraph(1)).toBe(false);
    expect(needsAudioGraph(1.01)).toBe(true);
    expect(graphAudioVolume(2.5, false)).toBe(2.5);
    expect(graphAudioVolume(2.5, true)).toBe(0);
  });

  it('builds stable audio keys for voice and screen-share channels', () => {
    expect(remoteAudioKey('peer-id', 'voice')).toBe('peer-id');
    expect(remoteAudioKey('peer-id', 'screen')).toBe('peer-id:screen');
  });

  it('detects MediaStream sources without depending on concrete browser classes', () => {
    expect(isMediaStreamSource(null)).toBe(false);
    expect(isMediaStreamSource({} as MediaProvider)).toBe(false);
    expect(
      isMediaStreamSource({
        getAudioTracks: () => [],
      } as unknown as MediaStream),
    ).toBe(true);
  });
});
