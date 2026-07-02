import { SymmetricKey } from '@haskou/value-objects';

import type { FakePeerConnection } from '../../../../../contexts/calls/infrastructure/media/FakePeerConnection';
import type { FakeSender } from '../../../../../contexts/calls/infrastructure/media/FakeSender';
import type { MockAudioContext } from '../../../../../contexts/calls/infrastructure/media/MockAudioContext';
import type { PeerConnectionManagerInternals } from '../../../../../contexts/calls/infrastructure/media/PeerConnectionManagerInternals';

import { CallPeerConnectionManager } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnectionManager';

const originalMediaStream = Object.getOwnPropertyDescriptor(
  globalThis,
  'MediaStream',
);
const originalPeerConnection = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCPeerConnection',
);
const originalSessionDescription = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCSessionDescription',
);
const originalRtpReceiver = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCRtpReceiver',
);
const originalRtpSender = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCRtpSender',
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

function encodedFrameStreams(): {
  readable: ReadableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
  writable: WritableStream<RTCEncodedAudioFrame | RTCEncodedVideoFrame>;
} {
  return {
    readable: new ReadableStream({
      start(controller): void {
        controller.close();
      },
    }),
    writable: new WritableStream(),
  };
}

function createFakeSender(track: MediaStreamTrack): FakeSender {
  let currentTrack: MediaStreamTrack | null = track;

  return {
    createEncodedStreams: jest.fn(() => encodedFrameStreams()),
    replaceTrack: jest.fn((nextTrack: MediaStreamTrack | null) => {
      currentTrack = nextTrack;

      return Promise.resolve();
    }),
    get track(): MediaStreamTrack | null {
      return currentTrack;
    },
  };
}

function installEncodedStreamSupport(): void {
  function FakeRtpSender(): void {}
  function FakeRtpReceiver(): void {}

  Object.defineProperty(FakeRtpSender.prototype, 'createEncodedStreams', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(FakeRtpReceiver.prototype, 'createEncodedStreams', {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(globalThis, 'RTCRtpSender', {
    configurable: true,
    value: FakeRtpSender,
  });
  Object.defineProperty(globalThis, 'RTCRtpReceiver', {
    configurable: true,
    value: FakeRtpReceiver,
  });
}

function createFakePeerConnection(): FakePeerConnection {
  const senders: RTCRtpSender[] = [];
  let offerCount = 0;
  let answerCount = 0;
  const peer: FakePeerConnection = {
    addEventListener: jest.fn(),
    addIceCandidate: jest.fn(() => Promise.resolve()),
    addTrack: jest.fn((track: MediaStreamTrack) => {
      const sender = createFakeSender(track);

      senders.push(sender as unknown as RTCRtpSender);

      return sender as unknown as RTCRtpSender;
    }),
    addTransceiver: jest.fn(),
    close: jest.fn(),
    connectionState: 'new',
    createAnswer: jest.fn(() => {
      answerCount += 1;

      return Promise.resolve({
        sdp: `answer-sdp-${answerCount}`,
        type: 'answer',
      } as RTCSessionDescriptionInit);
    }),
    createOffer: jest.fn(() => {
      offerCount += 1;

      return Promise.resolve({
        sdp: `offer-sdp-${offerCount}`,
        type: 'offer',
      } as RTCSessionDescriptionInit);
    }),
    getSenders: jest.fn(() => senders),
    iceConnectionState: 'new',
    localDescription: null,
    remoteDescription: null,
    removeTrack: jest.fn((sender: RTCRtpSender) => {
      const senderIndex = senders.indexOf(sender);

      if (senderIndex >= 0) senders.splice(senderIndex, 1);
    }),
    restartIce: jest.fn(),
    senders,
    setLocalDescription: jest.fn((description?: RTCSessionDescriptionInit) => {
      if (!description) return Promise.resolve();

      if (description.type === 'rollback') {
        peer.localDescription = null;
        peer.signalingState = 'stable';

        return Promise.resolve();
      }

      peer.localDescription = description;
      peer.signalingState =
        description.type === 'offer' ? 'have-local-offer' : 'stable';

      return Promise.resolve();
    }),
    setRemoteDescription: jest.fn((description: RTCSessionDescriptionInit) => {
      peer.remoteDescription = description;
      peer.signalingState =
        description.type === 'offer' ? 'have-remote-offer' : 'stable';

      return Promise.resolve();
    }),
    signalingState: 'stable',
  };

  return peer;
}

function registeredPeerEventListener(
  peer: FakePeerConnection,
  eventName: string,
): EventListener {
  const calls = (peer.addEventListener as jest.Mock).mock.calls as [
    string,
    EventListener,
  ][];
  const listener = calls.find(
    ([registeredEventName]) => registeredEventName === eventName,
  )?.[1];

  if (!listener) throw new Error(`Missing ${eventName} listener.`);

  return listener;
}

function installMediaStreamMock(): void {
  Object.defineProperty(globalThis, 'MediaStream', {
    configurable: true,
    value: jest.fn((tracks: MediaStreamTrack[] = []) =>
      mediaStreamWithTracks(tracks),
    ),
  });
}

function installPeerConnectionMock(
  peers: FakePeerConnection[],
  configurations: RTCConfiguration[] = [],
): void {
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: jest.fn((configuration: RTCConfiguration) => {
      const peer = createFakePeerConnection();

      configurations.push(configuration);
      peers.push(peer);

      return peer;
    }),
  });
}

function installSessionDescriptionMock(): void {
  Object.defineProperty(globalThis, 'RTCSessionDescription', {
    configurable: true,
    value: jest.fn((description: RTCSessionDescriptionInit) => description),
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
  property:
    | 'MediaStream'
    | 'RTCPeerConnection'
    | 'RTCSessionDescription'
    | 'RTCRtpReceiver'
    | 'RTCRtpSender'
    | 'window',
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
    jest.useRealTimers();
    restoreGlobalProperty('MediaStream', originalMediaStream);
    restoreGlobalProperty('RTCPeerConnection', originalPeerConnection);
    restoreGlobalProperty('RTCSessionDescription', originalSessionDescription);
    restoreGlobalProperty('RTCRtpReceiver', originalRtpReceiver);
    restoreGlobalProperty('RTCRtpSender', originalRtpSender);
    restoreGlobalProperty('window', originalWindow);
  });

  it('replaces recaptured microphone tracks without removing the sender', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const initialMicrophone = mediaTrack('microphone-1', 'audio');
    const nextMicrophone = mediaTrack('microphone-2', 'audio');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
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

  it('loads fresh ICE configuration for each new peer connection', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = new CallPeerConnectionManager();
    const firstConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password-1',
          urls: ['turn:relay-one.example.test', 'turns:relay-one.example.test'],
          username: 'turn-user-1',
        },
      ],
      iceTransportPolicy: 'relay',
    };
    const secondConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password-2',
          urls: 'turn:relay-two.example.test',
          username: 'turn-user-2',
        },
      ],
      iceTransportPolicy: 'all',
    };
    const rtcConfigurationProvider = jest
      .fn()
      .mockResolvedValueOnce(firstConfiguration)
      .mockResolvedValueOnce(secondConfiguration);

    manager.configure(rtcConfigurationProvider);

    await manager.ensurePeer('peer-identity-id-1', false, () =>
      Promise.resolve(),
    );
    await manager.ensurePeer('peer-identity-id-2', false, () =>
      Promise.resolve(),
    );
    await manager.ensurePeer('peer-identity-id-1', false, () =>
      Promise.resolve(),
    );

    expect(rtcConfigurationProvider).toHaveBeenCalledTimes(2);
    expect(configurations).toEqual([firstConfiguration, secondConfiguration]);
  });

  it('restarts ICE when an established peer connection fails', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const connectionStateListener = registeredPeerEventListener(
      peer,
      'connectionstatechange',
    );

    peer.connectionState = 'failed';
    peer.iceConnectionState = 'failed';
    connectionStateListener(new Event('connectionstatechange'));
    jest.runOnlyPendingTimers();

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('does not restart ICE when a transient disconnection recovers', async () => {
    jest.useFakeTimers();
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const connectionStateListener = registeredPeerEventListener(
      peer,
      'connectionstatechange',
    );

    peer.connectionState = 'disconnected';
    peer.iceConnectionState = 'disconnected';
    connectionStateListener(new Event('connectionstatechange'));
    peer.connectionState = 'connected';
    peer.iceConnectionState = 'connected';
    connectionStateListener(new Event('connectionstatechange'));
    jest.runOnlyPendingTimers();

    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('drops TURN ICE servers without credentials before creating a peer connection', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = new CallPeerConnectionManager();

    manager.configure(() =>
      Promise.resolve({
        iceServers: [
          {
            urls: [
              'turn:relay.example.test:4101?transport=udp',
              'turn:relay.example.test:4101?transport=tcp',
            ],
          },
        ],
        iceTransportPolicy: 'relay',
      }),
    );

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(peers).toHaveLength(1);
    expect(configurations).toEqual([
      {
        iceServers: [],
        iceTransportPolicy: 'all',
      },
    ]);
  });

  it('exchanges offer and answer between joined peers', async () => {
    const peers: FakePeerConnection[] = [];
    const manager = new CallPeerConnectionManager();
    const sentSignals: Array<{
      payload: Record<string, unknown>;
      recipientIdentityId: string;
      signalType: string;
    }> = [];

    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );

    await manager.ensurePeer(
      'remote-identity-id',
      true,
      (recipientIdentityId, signalType, payload) => {
        sentSignals.push({ payload, recipientIdentityId, signalType });

        return Promise.resolve();
      },
    );

    const [peer] = peers;
    const offerSignal = sentSignals.find(
      (signal) => signal.signalType === 'offer',
    );

    expect(offerSignal).toMatchObject({
      payload: expect.objectContaining({ type: 'offer' }),
      recipientIdentityId: 'remote-identity-id',
      signalType: 'offer',
    });
    expect(peer.localDescription).toMatchObject({ type: 'offer' });

    await manager.handleSignal(
      'remote-identity-id',
      'answer',
      {
        sdp: 'remote-answer-sdp',
        type: 'answer',
      },
      (recipientIdentityId, signalType, payload) => {
        sentSignals.push({ payload, recipientIdentityId, signalType });

        return Promise.resolve();
      },
      'current-identity-id',
    );

    expect(peer.remoteDescription).toMatchObject({
      sdp: 'remote-answer-sdp',
      type: 'answer',
    });
    expect(peer.signalingState).toBe('stable');
  });

  it('configures encoded streams for encrypted local media senders', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const microphone = mediaTrack('microphone-1', 'audio');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(SymmetricKey.generate().valueOf(), true);
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [sender] = peer.senders as unknown as FakeSender[];

    expect(sender.createEncodedStreams).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent peer creation for the same identity', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = new CallPeerConnectionManager();
    const rtcConfiguration: RTCConfiguration = {
      iceServers: [
        {
          credential: 'turn-password',
          urls: 'turn:relay.example.test',
          username: 'turn-user',
        },
      ],
      iceTransportPolicy: 'relay',
    };
    let resolveConfiguration!: (configuration: RTCConfiguration) => void;
    const pendingConfiguration = new Promise<RTCConfiguration>((resolve) => {
      resolveConfiguration = resolve;
    });
    const rtcConfigurationProvider = jest
      .fn()
      .mockReturnValue(pendingConfiguration);

    manager.configure(rtcConfigurationProvider);

    const firstEnsurePeer = manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    const secondEnsurePeer = manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    expect(rtcConfigurationProvider).toHaveBeenCalledTimes(1);
    expect(peers).toHaveLength(0);

    resolveConfiguration(rtcConfiguration);
    await Promise.all([firstEnsurePeer, secondEnsurePeer]);

    expect(peers).toHaveLength(1);
    expect(configurations).toEqual([rtcConfiguration]);
  });

  it('sends one initial offer when concurrent peer ensures target the same identity', async () => {
    const peers: FakePeerConnection[] = [];
    const sentSignals: Array<{ signalType: string }> = [];

    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('microphone', 'audio')]),
    );

    await Promise.all([
      manager.ensurePeer('peer-identity-id', true, (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      }),
      manager.ensurePeer('peer-identity-id', true, (_recipient, signalType) => {
        sentSignals.push({ signalType });

        return Promise.resolve();
      }),
    ]);

    const [peer] = peers;

    expect(peers).toHaveLength(1);
    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(sentSignals).toEqual([{ signalType: 'offer' }]);
  });

  it('adds screen sharing without replacing the microphone sender', async () => {
    const peers: FakePeerConnection[] = [];

    installMediaStreamMock();
    installPeerConnectionMock(peers);
    const manager = new CallPeerConnectionManager();
    const microphone = mediaTrack('microphone', 'audio');
    const screen = mediaTrack('screen', 'video', 'detail');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
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

    manager.configure(() => Promise.resolve({ iceServers: [] }));
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

    manager.configure(() => Promise.resolve({ iceServers: [] }));
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
