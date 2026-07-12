import {
  hasAudioTrack,
  isRemoteScreenShareAudioTrack,
  isRemoteScreenShareTrack,
  isScreenShareAudioTrack,
  isScreenShareTrack,
  replacementLocalTrack,
} from '../../../../../contexts/calls/infrastructure/media/callMediaTrackClassification';

function track(
  id: string,
  kind: MediaStreamTrack['kind'],
  options: { contentHint?: string; label?: string } = {},
): MediaStreamTrack {
  return {
    contentHint: options.contentHint ?? '',
    id,
    kind,
    label: options.label ?? id,
  } as unknown as MediaStreamTrack;
}

function stream(id: string, tracks: MediaStreamTrack[] = []): MediaStream {
  return {
    getAudioTracks: () =>
      tracks.filter((currentTrack) => currentTrack.kind === 'audio'),
    id,
  } as unknown as MediaStream;
}

describe('call media track classification', () => {
  it('classifies local camera, microphone, screen, and screen audio slots', () => {
    const microphone = track('microphone', 'audio');
    const nextMicrophone = track('next-microphone', 'audio');
    const screenAudio = track('screen-audio', 'audio', {
      contentHint: 'music',
    });
    const nextScreenAudio = track('next-screen-audio', 'audio', {
      contentHint: 'music',
    });
    const screenVideo = track('screen-video', 'video', {
      contentHint: 'detail',
    });

    expect(isScreenShareTrack(screenVideo)).toBe(true);
    expect(isScreenShareAudioTrack(screenAudio)).toBe(true);
    expect(
      replacementLocalTrack(microphone, [nextScreenAudio, nextMicrophone]),
    ).toBe(nextMicrophone);
    expect(
      replacementLocalTrack(screenAudio, [nextMicrophone, nextScreenAudio]),
    ).toBe(nextScreenAudio);
  });

  it('recognizes remote screen video from negotiated ids, streams, hints, and labels', () => {
    const negotiatedTrack = track('track-id', 'video');
    const negotiatedStreamTrack = track('stream-track', 'video');
    const hintedTrack = track('hinted', 'video', { contentHint: 'detail' });
    const labelledTrack = track('labelled', 'video', { label: 'Display 1' });
    const cameraTrack = track('camera', 'video', { label: 'Camera' });

    expect(
      isRemoteScreenShareTrack(
        negotiatedTrack,
        [],
        new Set(['track-id']),
        new Set(),
      ),
    ).toBe(true);
    expect(
      isRemoteScreenShareTrack(
        negotiatedStreamTrack,
        [stream('stream-id')],
        new Set(),
        new Set(['stream-id']),
      ),
    ).toBe(true);
    expect(
      isRemoteScreenShareTrack(hintedTrack, [], new Set(), new Set()),
    ).toBe(true);
    expect(
      isRemoteScreenShareTrack(labelledTrack, [], new Set(), new Set()),
    ).toBe(true);
    expect(
      isRemoteScreenShareTrack(cameraTrack, [], new Set(), new Set()),
    ).toBe(false);
  });

  it('recognizes remote screen audio separately from voice audio', () => {
    const negotiatedTrack = track('screen-audio-id', 'audio');
    const hintedTrack = track('hinted-screen-audio', 'audio', {
      contentHint: 'music',
    });
    const voiceTrack = track('voice', 'audio');

    expect(
      isRemoteScreenShareAudioTrack(
        negotiatedTrack,
        [],
        new Set(['screen-audio-id']),
        new Set(),
      ),
    ).toBe(true);
    expect(
      isRemoteScreenShareAudioTrack(hintedTrack, [], new Set(), new Set()),
    ).toBe(true);
    expect(
      isRemoteScreenShareAudioTrack(voiceTrack, [], new Set(), new Set()),
    ).toBe(false);
  });

  it('treats streams with bundled audio as audible media', () => {
    const videoTrack = track('video', 'video');
    const audioTrack = track('audio', 'audio');

    expect(hasAudioTrack(videoTrack, stream('without-audio', []))).toBe(false);
    expect(hasAudioTrack(videoTrack, stream('with-audio', [audioTrack]))).toBe(
      true,
    );
    expect(hasAudioTrack(audioTrack, stream('without-audio', []))).toBe(true);
  });
});
