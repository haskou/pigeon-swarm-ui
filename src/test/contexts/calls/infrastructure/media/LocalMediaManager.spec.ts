import { LocalMediaManager } from '../../../../../contexts/calls/infrastructure/media/LocalMediaManager';

const originalMediaStream = Object.getOwnPropertyDescriptor(
  globalThis,
  'MediaStream',
);
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

type MockAudioContext = AudioContext & {
  gain: GainNode;
};

function mediaTrack(
  id: string,
  kind: MediaStreamTrack['kind'],
): MediaStreamTrack {
  return {
    addEventListener: jest.fn(),
    contentHint: '',
    enabled: true,
    id,
    kind,
    label: id,
    muted: false,
    readyState: 'live',
    removeEventListener: jest.fn(),
    stop: jest.fn(),
  } as unknown as MediaStreamTrack;
}

function mediaStreamWithTracks(tracks: MediaStreamTrack[]): MediaStream {
  const streamTracks = [...tracks];

  return {
    addTrack: jest.fn((track: MediaStreamTrack) => {
      streamTracks.push(track);
    }),
    getAudioTracks: () =>
      streamTracks.filter((track) => track.kind === 'audio'),
    getTracks: () => streamTracks,
    getVideoTracks: () =>
      streamTracks.filter((track) => track.kind === 'video'),
    removeTrack: jest.fn((track: MediaStreamTrack) => {
      const trackIndex = streamTracks.indexOf(track);

      if (trackIndex >= 0) streamTracks.splice(trackIndex, 1);
    }),
  } as unknown as MediaStream;
}

function installMediaStreamMock(): void {
  Object.defineProperty(globalThis, 'MediaStream', {
    configurable: true,
    value: jest.fn((tracks: MediaStreamTrack[] = []) =>
      mediaStreamWithTracks(tracks),
    ),
  });
}

function installNavigatorMock(screenStream: MediaStream): jest.Mock {
  const getDisplayMedia = jest.fn().mockResolvedValue(screenStream);

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getDisplayMedia,
      },
    },
  });

  return getDisplayMedia;
}

function installAudioContextMock(
  outputTrack: MediaStreamTrack,
): MockAudioContext {
  const source = {
    connect: jest.fn((node: unknown) => node),
    disconnect: jest.fn(),
  };
  const gain = {
    connect: jest.fn((node: unknown) => node),
    disconnect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
    },
  } as unknown as GainNode;
  const audioContext = {
    close: jest.fn(() => Promise.resolve()),
    createGain: jest.fn(() => gain),
    createMediaStreamDestination: jest.fn(() => ({
      stream: mediaStreamWithTracks([outputTrack]),
    })),
    createMediaStreamSource: jest.fn(() => source),
    currentTime: 12,
    gain,
  } as unknown as MockAudioContext;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: jest.fn(() => audioContext),
    },
  });

  return audioContext;
}

function restoreGlobalProperty(
  property: 'MediaStream' | 'navigator' | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe(LocalMediaManager.name, () => {
  afterEach(() => {
    restoreGlobalProperty('MediaStream', originalMediaStream);
    restoreGlobalProperty('navigator', originalNavigator);
    restoreGlobalProperty('window', originalWindow);
  });

  it('keeps the screen preview stream stable while screen sharing is active', async () => {
    const screenTrack = mediaTrack('screen-video', 'video');
    const screenStream = mediaStreamWithTracks([screenTrack]);
    const manager = new LocalMediaManager();

    installMediaStreamMock();
    installNavigatorMock(screenStream);

    await manager.enableScreenShare();

    const firstPreview = manager.screenPreviewStream();
    const secondPreview = manager.screenPreviewStream();

    expect(firstPreview).toBe(secondPreview);
    expect(firstPreview?.getVideoTracks()).toEqual([screenTrack]);
  });

  it('requests screen audio by default when screen sharing starts', async () => {
    const screenTrack = mediaTrack('screen-video', 'video');
    const screenStream = mediaStreamWithTracks([screenTrack]);
    const manager = new LocalMediaManager();

    installMediaStreamMock();
    const getDisplayMedia = installNavigatorMock(screenStream);

    await manager.enableScreenShare();

    expect(getDisplayMedia).toHaveBeenCalledWith({
      audio: true,
      video: true,
    });
  });

  it('clears the screen preview stream when screen sharing stops', async () => {
    const screenTrack = mediaTrack('screen-video', 'video');
    const screenStream = mediaStreamWithTracks([screenTrack]);
    const manager = new LocalMediaManager();

    installMediaStreamMock();
    installNavigatorMock(screenStream);

    await manager.enableScreenShare();

    expect(manager.screenPreviewStream()).toBeDefined();

    manager.disableScreenShare();

    expect(manager.screenPreviewStream()).toBeUndefined();
    expect(screenTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('applies screen share audio volume to the outgoing screen audio track', async () => {
    const screenTrack = mediaTrack('screen-video', 'video');
    const sourceAudioTrack = mediaTrack('screen-audio-source', 'audio');
    const outputAudioTrack = mediaTrack('screen-audio-output', 'audio');
    const screenStream = mediaStreamWithTracks([screenTrack, sourceAudioTrack]);
    const manager = new LocalMediaManager();
    const audioContext = installAudioContextMock(outputAudioTrack);

    installMediaStreamMock();
    installNavigatorMock(screenStream);

    await manager.enableScreenShare({ audioEnabled: true });
    manager.setScreenShareAudioVolume(250);

    expect(audioContext.gain.gain.setValueAtTime).toHaveBeenLastCalledWith(
      2.5,
      12,
    );
    expect(manager.previewStream()?.getAudioTracks()).toEqual([
      outputAudioTrack,
    ]);

    manager.disableScreenShare();

    expect(sourceAudioTrack.stop).toHaveBeenCalledTimes(1);
    expect(outputAudioTrack.stop).toHaveBeenCalledTimes(1);
  });
});
