import { CallPeerConnectionManager } from './callPeerConnectionManager';

type FakeSender = Pick<RTCRtpSender, 'replaceTrack' | 'track'> & {
  replaceTrack: jest.MockedFunction<
    (track: MediaStreamTrack | null) => Promise<void>
  >;
};

type FakePeerConnection = Pick<
  RTCPeerConnection,
  | 'addEventListener'
  | 'addTrack'
  | 'addTransceiver'
  | 'close'
  | 'getSenders'
  | 'removeTrack'
> & {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  localDescription: RTCSessionDescriptionInit | null;
  senders: RTCRtpSender[];
  signalingState: RTCSignalingState;
};

type PeerConnectionManagerInternals = {
  handleRemoteTrack(peerIdentityId: string, event: RTCTrackEvent): void;
  remoteAudio: Map<string, HTMLAudioElement>;
  remoteAudioContexts: Map<string, AudioContext>;
  remoteAudioGains: Map<string, GainNode>;
  remoteAudioOutputSources: Map<string, MediaStreamAudioSourceNode>;
  remoteAudioOutputStreams: Map<string, MediaStream>;
  remoteAudioStreams: Map<string, MediaStream>;
  remoteScreenAudioTrackIds: Map<string, Set<string>>;
  remoteScreenStreams: Map<string, MediaStream>;
  remoteScreenStreamIds: Map<string, Set<string>>;
  remoteStreams: Map<string, MediaStream>;
};

type MockAudioContext = AudioContext & {
  createdGain: GainNode;
  createdSource: MediaStreamAudioSourceNode;
};

const originalMediaStream = Object.getOwnPropertyDescriptor(
  globalThis,
  'MediaStream',
);
const originalPeerConnection = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCPeerConnection',
);
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

function mediaStreamWithTracks(
  tracks: MediaStreamTrack[],
  id = 'media-stream-id',
): MediaStream {
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
    id,
    removeTrack: jest.fn((track: MediaStreamTrack) => {
      const trackIndex = streamTracks.indexOf(track);

      if (trackIndex >= 0) streamTracks.splice(trackIndex, 1);
    }),
  } as unknown as MediaStream;
}

function mediaTrack(
  id: string,
  kind: MediaStreamTrack['kind'],
  contentHint = '',
): MediaStreamTrack {
  return {
    addEventListener: jest.fn(),
    contentHint,
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

function audioElement(): HTMLAudioElement {
  return {
    pause: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    srcObject: null,
    volume: 1,
  } as unknown as HTMLAudioElement;
}

function gainNode(): GainNode {
  return {
    connect: jest.fn((destination: unknown) => destination),
    gain: {
      setValueAtTime: jest.fn(),
      value: 1,
    },
  } as unknown as GainNode;
}

function audioContext(): AudioContext {
  return {
    close: jest.fn(() => Promise.resolve()),
    currentTime: 12,
    resume: jest.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}

function audioSource(): MediaStreamAudioSourceNode {
  return {
    connect: jest.fn((node: unknown) => node),
    disconnect: jest.fn(),
  } as unknown as MediaStreamAudioSourceNode;
}

function mockAudioContext(): MockAudioContext {
  const source = audioSource();
  const gain = gainNode();

  return {
    close: jest.fn(() => Promise.resolve()),
    createdGain: gain,
    createdSource: source,
    createGain: jest.fn(() => gain),
    createMediaStreamSource: jest.fn(() => source),
    currentTime: 12,
    destination: {},
    resume: jest.fn(() => Promise.resolve()),
  } as unknown as MockAudioContext;
}

function managerInternals(
  manager: CallPeerConnectionManager,
): PeerConnectionManagerInternals {
  return manager as unknown as PeerConnectionManagerInternals;
}

function remoteTrackEvent(
  track: MediaStreamTrack,
  streams: MediaStream[],
): RTCTrackEvent {
  return {
    streams,
    track,
  } as unknown as RTCTrackEvent;
}

function createFakeSender(track: MediaStreamTrack): FakeSender {
  let currentTrack: MediaStreamTrack | null = track;

  return {
    replaceTrack: jest.fn((nextTrack: MediaStreamTrack | null) => {
      currentTrack = nextTrack;

      return Promise.resolve();
    }),
    get track(): MediaStreamTrack | null {
      return currentTrack;
    },
  };
}

function createFakePeerConnection(): FakePeerConnection {
  const senders: RTCRtpSender[] = [];
  const peer: FakePeerConnection = {
    addEventListener: jest.fn(),
    addTrack: jest.fn((track: MediaStreamTrack) => {
      const sender = createFakeSender(track);

      senders.push(sender as unknown as RTCRtpSender);

      return sender as unknown as RTCRtpSender;
    }),
    addTransceiver: jest.fn(),
    close: jest.fn(),
    connectionState: 'new',
    getSenders: jest.fn(() => senders),
    iceConnectionState: 'new',
    localDescription: null,
    removeTrack: jest.fn((sender: RTCRtpSender) => {
      const senderIndex = senders.indexOf(sender);

      if (senderIndex >= 0) senders.splice(senderIndex, 1);
    }),
    senders,
    signalingState: 'stable',
  };

  return peer;
}

function installMediaStreamMock(): void {
  Object.defineProperty(globalThis, 'MediaStream', {
    configurable: true,
    value: jest.fn((tracks: MediaStreamTrack[] = []) =>
      mediaStreamWithTracks(tracks),
    ),
  });
}

function installPeerConnectionMock(peers: FakePeerConnection[]): void {
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: jest.fn(() => {
      const peer = createFakePeerConnection();

      peers.push(peer);

      return peer;
    }),
  });
}

function installAudioContextMock(context: MockAudioContext): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: jest.fn(() => context),
    },
  });
}

function restoreGlobalProperty(
  property: 'MediaStream' | 'RTCPeerConnection' | 'window',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor);

    return;
  }

  Reflect.deleteProperty(globalThis, property);
}

describe(CallPeerConnectionManager.name, () => {
  afterEach(() => {
    restoreGlobalProperty('MediaStream', originalMediaStream);
    restoreGlobalProperty('RTCPeerConnection', originalPeerConnection);
    restoreGlobalProperty('window', originalWindow);
  });

  it('replaces recaptured microphone tracks without removing the sender', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const initialMicrophone = mediaTrack('microphone-1', 'audio');
    const nextMicrophone = mediaTrack('microphone-2', 'audio');

    manager.configure({ iceServers: [] });
    manager.setLocalStream(mediaStreamWithTracks([initialMicrophone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(mediaStreamWithTracks([nextMicrophone]));

    expect(microphoneSender.replaceTrack).toHaveBeenCalledWith(nextMicrophone);
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(1);
  });

  it('adds screen sharing without replacing the microphone sender', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const microphone = mediaTrack('microphone', 'audio');
    const screen = mediaTrack('screen', 'video', 'detail');

    manager.configure({ iceServers: [] });
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(mediaStreamWithTracks([microphone, screen]));

    expect(microphoneSender.replaceTrack).not.toHaveBeenCalled();
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(2);
    expect(peer.addTrack).toHaveBeenLastCalledWith(
      screen,
      expect.objectContaining({
        getTracks: expect.any(Function) as unknown,
      }),
    );
  });

  it('adds screen share audio without replacing the microphone sender', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const microphone = mediaTrack('microphone', 'audio');
    const screen = mediaTrack('screen', 'video', 'detail');
    const screenAudio = mediaTrack('screen-audio', 'audio', 'music');

    manager.configure({ iceServers: [] });
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [microphoneSender] = peer.senders as unknown as FakeSender[];

    manager.setLocalStream(
      mediaStreamWithTracks([microphone, screen, screenAudio]),
    );

    expect(microphoneSender.replaceTrack).not.toHaveBeenCalled();
    expect(peer.removeTrack).not.toHaveBeenCalled();
    expect(peer.addTrack).toHaveBeenCalledTimes(3);
    expect(peer.addTrack).toHaveBeenLastCalledWith(
      screenAudio,
      expect.objectContaining({
        getTracks: expect.any(Function) as unknown,
      }),
    );
  });

  it('uses only Web Audio output when gain is already active', () => {
    const manager = new CallPeerConnectionManager();
    const audio = audioElement();
    const gain = gainNode();
    const context = audioContext();
    const internals = managerInternals(manager);

    internals.remoteAudio.set('peer-identity-id', audio);
    internals.remoteAudioGains.set('peer-identity-id', gain);
    internals.remoteAudioContexts.set('peer-identity-id', context);

    manager.setPeerVolume('peer-identity-id', 300);

    expect(audio.volume).toBe(0);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(3, 12);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('creates a single Web Audio output path when remote volume exceeds one hundred percent', () => {
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const audio = audioElement();
    const audioTrack = mediaTrack('remote-audio-track', 'audio');
    const audioStream = mediaStreamWithTracks([audioTrack], 'audio-stream');
    const context = mockAudioContext();

    installAudioContextMock(context);
    audio.srcObject = audioStream;
    internals.remoteAudio.set('peer-identity-id', audio);

    manager.setPeerVolume('peer-identity-id', 250);

    expect(audio.volume).toBe(0);
    expect(context.createMediaStreamSource).toHaveBeenCalledWith(audioStream);
    expect(context.createdGain.gain.value).toBe(2.5);
    expect(context.createdSource.connect).toHaveBeenCalledWith(
      context.createdGain,
    );
    expect(internals.remoteAudioGains.get('peer-identity-id')).toBe(
      context.createdGain,
    );
    expect(internals.remoteAudioOutputStreams.get('peer-identity-id')).toBe(
      audioStream,
    );
  });

  it('mutes the Web Audio output while deafened', () => {
    const manager = new CallPeerConnectionManager();
    const audio = audioElement();
    const gain = gainNode();
    const context = audioContext();
    const internals = managerInternals(manager);

    internals.remoteAudio.set('peer-identity-id', audio);
    internals.remoteAudioGains.set('peer-identity-id', gain);
    internals.remoteAudioContexts.set('peer-identity-id', context);

    manager.setPeerVolume('peer-identity-id', 250);
    manager.setDeafened(true);
    manager.setDeafened(false);

    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(1, 2.5, 12);
    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(2, 0, 12);
    expect(gain.gain.setValueAtTime).toHaveBeenNthCalledWith(3, 2.5, 12);
    expect(audio.pause).not.toHaveBeenCalled();
  });

  it('falls back to native audio volume when Web Audio gain is unavailable', () => {
    const manager = new CallPeerConnectionManager();
    const audio = audioElement();

    managerInternals(manager).remoteAudio.set('peer-identity-id', audio);

    manager.setPeerVolume('peer-identity-id', 250);

    expect(audio.volume).toBe(1);

    manager.setPeerVolume('peer-identity-id', 50);

    expect(audio.volume).toBe(0.5);
  });

  it('classifies remote screen share by stream id metadata', () => {
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const screenTrack = mediaTrack('receiver-video-track', 'video');
    const screenStream = mediaStreamWithTracks(
      [screenTrack],
      'sender-screen-stream',
    );

    installMediaStreamMock();
    internals.remoteScreenStreamIds.set(
      'peer-identity-id',
      new Set(['sender-screen-stream']),
    );

    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(screenTrack, [screenStream]),
    );

    expect(internals.remoteScreenStreams.get('peer-identity-id')).toBeDefined();
    expect(internals.remoteStreams.has('peer-identity-id')).toBe(false);
  });

  it('does not replace remote audio output with video-only streams', () => {
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const audio = audioElement();
    const audioTrack = mediaTrack('remote-audio-track', 'audio');
    const audioStream = mediaStreamWithTracks([audioTrack], 'audio-stream');
    const videoTrack = mediaTrack('remote-video-track', 'video');
    const videoStream = mediaStreamWithTracks([videoTrack], 'video-stream');

    audio.srcObject = audioStream;
    internals.remoteAudio.set('peer-identity-id', audio);

    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(videoTrack, [videoStream]),
    );

    expect(internals.remoteStreams.get('peer-identity-id')).toBe(videoStream);
    expect(audio.srcObject).toBe(audioStream);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('mixes multiple remote voice audio tracks for the same peer', () => {
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const audio = audioElement();
    const microphoneTrack = mediaTrack('remote-microphone-track', 'audio');
    const screenAudioTrack = mediaTrack('remote-second-audio-track', 'audio');

    installMediaStreamMock();
    internals.remoteAudio.set('peer-identity-id', audio);

    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(microphoneTrack, [
        mediaStreamWithTracks([microphoneTrack], 'microphone-stream'),
      ]),
    );
    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(screenAudioTrack, [
        mediaStreamWithTracks([screenAudioTrack], 'screen-audio-stream'),
      ]),
    );

    const mixedStream = internals.remoteAudioStreams.get('peer-identity-id');

    expect(mixedStream?.getAudioTracks()).toEqual([
      microphoneTrack,
      screenAudioTrack,
    ]);
    expect(audio.srcObject).toBe(mixedStream);
  });

  it('keeps remote screen share audio on a separate volume channel', () => {
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const voiceAudio = audioElement();
    const screenAudio = audioElement();
    const voiceTrack = mediaTrack('remote-microphone-track', 'audio');
    const screenAudioTrack = mediaTrack('remote-screen-audio-track', 'audio');

    installMediaStreamMock();
    internals.remoteAudio.set('peer-identity-id', voiceAudio);
    internals.remoteAudio.set('peer-identity-id:screen', screenAudio);
    internals.remoteScreenAudioTrackIds.set(
      'peer-identity-id',
      new Set(['remote-screen-audio-track']),
    );

    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(voiceTrack, [
        mediaStreamWithTracks([voiceTrack], 'microphone-stream'),
      ]),
    );
    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(screenAudioTrack, [
        mediaStreamWithTracks([screenAudioTrack], 'screen-audio-stream'),
      ]),
    );

    manager.setPeerScreenShareVolume('peer-identity-id', 0);

    expect(voiceAudio.srcObject).toBe(
      internals.remoteAudioStreams.get('peer-identity-id'),
    );
    expect(screenAudio.srcObject).toBe(
      internals.remoteAudioStreams.get('peer-identity-id:screen'),
    );
    expect(voiceAudio.volume).toBe(1);
    expect(screenAudio.volume).toBe(0);
  });

  it('removes stale peers and their audio output when they leave', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const internals = managerInternals(manager);
    const audio = audioElement();
    const source = audioSource();
    const context = audioContext();
    const gain = gainNode();
    const screenTrack = mediaTrack('remote-screen-track', 'video');

    manager.configure({ iceServers: [] });
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    audio.srcObject = mediaStreamWithTracks([
      mediaTrack('remote-audio-track', 'audio'),
    ]);
    internals.remoteAudio.set('peer-identity-id', audio);
    internals.remoteAudioContexts.set('peer-identity-id', context);
    internals.remoteAudioGains.set('peer-identity-id', gain);
    internals.remoteAudioOutputSources.set('peer-identity-id', source);
    internals.remoteAudioOutputStreams.set('peer-identity-id', audio.srcObject);
    internals.remoteStreams.set('peer-identity-id', audio.srcObject);
    internals.remoteScreenStreams.set(
      'peer-identity-id',
      mediaStreamWithTracks([screenTrack]),
    );
    internals.remoteScreenStreamIds.set(
      'peer-identity-id',
      new Set(['remote-screen-stream-id']),
    );

    manager.retainPeers(new Set());

    expect(peers[0]?.close).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.remove).toHaveBeenCalledTimes(1);
    expect(audio.srcObject).toBeNull();
    expect(internals.remoteAudio.has('peer-identity-id')).toBe(false);
    expect(internals.remoteAudioGains.has('peer-identity-id')).toBe(false);
    expect(internals.remoteAudioOutputStreams.has('peer-identity-id')).toBe(
      false,
    );
    expect(internals.remoteStreams.has('peer-identity-id')).toBe(false);
    expect(internals.remoteScreenStreams.has('peer-identity-id')).toBe(false);
  });
});
