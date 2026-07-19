import type { MockProxy } from 'jest-mock-extended';

import { mock } from 'jest-mock-extended';

import { CallScreenShareStreams } from '../../../../../contexts/calls/infrastructure/media/CallScreenShareStreams';
import { RemoteCallAudio } from '../../../../../contexts/calls/infrastructure/media/RemoteCallAudio';

describe('CallScreenShareStreams', () => {
  let remoteAudio: MockProxy<RemoteCallAudio>;

  beforeEach(() => {
    remoteAudio = mock<RemoteCallAudio>();
    Object.defineProperty(globalThis, 'MediaStream', {
      configurable: true,
      value: jest.fn((tracks: MediaStreamTrack[] = []) => ({
        getTracks: () => tracks,
        id: 'screen-stream',
      })),
    });
  });

  it('removes stale screen audio when an SDP description stops advertising it', () => {
    const streams = new CallScreenShareStreams(remoteAudio);

    streams.rememberRemoteMetadata('peer-1', {
      screenAudioStreamIds: [],
      screenAudioTrackIds: [],
      type: 'offer',
    });

    expect(remoteAudio.removeScreen).toHaveBeenCalledWith('peer-1');
  });

  it('forgets all remote screen state for a departed peer', () => {
    const streams = new CallScreenShareStreams(remoteAudio);

    streams.forget('peer-1');

    expect(streams.streams()).toEqual({});
    expect(remoteAudio.removeScreen).toHaveBeenCalledWith('peer-1');
  });

  it('classifies a remote video track from advertised stream metadata', () => {
    const streams = new CallScreenShareStreams(remoteAudio);
    const track = {
      addEventListener: jest.fn(),
      id: 'screen-track',
      kind: 'video',
    } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      id: 'advertised-screen-stream',
    } as unknown as MediaStream;

    streams.rememberRemoteMetadata('peer-1', {
      screenStreamIds: ['advertised-screen-stream'],
      type: 'offer',
    });

    expect(
      streams.handleRemoteTrack('peer-1', {
        streams: [stream],
        track,
      } as unknown as RTCTrackEvent),
    ).toBe(true);
    expect(streams.streams()['peer-1']).toBeDefined();
  });
});
