import { SymmetricKey } from '@haskou/value-objects';

import type { SignalSender } from '../../../../../contexts/calls/infrastructure/media/descriptionPayload';
import type { FakePeerConnection } from '../../../../../contexts/calls/infrastructure/media/FakePeerConnection';
import type { FakeSender } from '../../../../../contexts/calls/infrastructure/media/FakeSender';
import type { PeerConnectionManagerInternals } from '../../../../../contexts/calls/infrastructure/media/PeerConnectionManagerInternals';

import { CallPeerConnectionManager } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnectionManager';
import { EncodedCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/EncodedCallMediaCipher';
import { RemoteCallAudio } from '../../../../../contexts/calls/infrastructure/media/RemoteCallAudio';

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

type RtcConfigurationWithEncodedInsertableStreams = RTCConfiguration & {
  encodedInsertableStreams?: boolean;
};

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

function remoteAudioElement(): HTMLAudioElement {
  return {
    dataset: {},
    pause: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    srcObject: null,
    volume: 1,
  } as unknown as HTMLAudioElement;
}

function callPeerConnectionManager(): CallPeerConnectionManager {
  return new CallPeerConnectionManager(
    new RemoteCallAudio({
      create: remoteAudioElement,
      mount: jest.fn(),
    }),
  );
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
    const manager = callPeerConnectionManager();
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
    const manager = callPeerConnectionManager();
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
    const manager = callPeerConnectionManager();

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
    const manager = callPeerConnectionManager();

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

  it('passes backend ICE configuration to the peer connection unchanged', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();

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
        iceServers: [
          {
            urls: [
              'turn:relay.example.test:4101?transport=udp',
              'turn:relay.example.test:4101?transport=tcp',
            ],
          },
        ],
        iceTransportPolicy: 'relay',
      },
    ]);
  });

  it('exchanges offer and answer between joined peers', async () => {
    const peers: FakePeerConnection[] = [];
    const manager = callPeerConnectionManager();
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
    const configurations: RtcConfigurationWithEncodedInsertableStreams[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();
    const microphone = mediaTrack('microphone-1', 'audio');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(SymmetricKey.generate().valueOf(), true);
    manager.setLocalStream(mediaStreamWithTracks([microphone]));

    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );

    const [peer] = peers;
    const [sender] = peer.senders as unknown as FakeSender[];

    expect(configurations[0]?.encodedInsertableStreams).toBe(true);
    expect(sender.createEncodedStreams).toHaveBeenCalledTimes(1);
  });

  it('does not announce encrypted outbound media to peers without metadata', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(SymmetricKey.generate().valueOf(), true);
    manager.setLocalStream(
      mediaStreamWithTracks([mediaTrack('audio', 'audio')]),
    );

    await manager.ensurePeer('peer-identity-id', true, sendSignal);

    expect(sendSignal).toHaveBeenCalledWith(
      'peer-identity-id',
      'offer',
      expect.objectContaining({
        mediaEncryption: {
          acceptsEncrypted: true,
          enabled: false,
          version: 1,
        },
      }),
    );
  });

  it('reports media encryption only when both peer directions are encrypted', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(SymmetricKey.generate().valueOf(), true);
    await manager.ensurePeer('peer-identity-id', false, sendSignal);

    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      {
        mediaEncryption: {
          acceptsEncrypted: true,
          enabled: false,
          version: 1,
        },
        sdp: 'unencrypted-offer',
        type: 'offer',
      },
      sendSignal,
      'current-identity-id',
    );

    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(false);

    await manager.handleSignal(
      'peer-identity-id',
      'offer',
      {
        mediaEncryption: {
          acceptsEncrypted: true,
          enabled: true,
          version: 1,
        },
        sdp: 'encrypted-offer',
        type: 'offer',
      },
      sendSignal,
      'current-identity-id',
    );

    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(true);
  });

  it('re-announces encrypted sending after a peer accepts it in an answer', async () => {
    const peers: FakePeerConnection[] = [];

    installEncodedStreamSupport();
    installSessionDescriptionMock();
    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const sendSignal = jest.fn(() =>
      Promise.resolve(),
    ) as unknown as jest.MockedFunction<SignalSender>;

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    manager.configureMediaEncryption(SymmetricKey.generate().valueOf(), true);

    await manager.ensurePeer('peer-identity-id', true, sendSignal);
    await manager.handleSignal(
      'peer-identity-id',
      'answer',
      {
        mediaEncryption: {
          acceptsEncrypted: true,
          enabled: true,
          version: 1,
        },
        sdp: 'encrypted-answer',
        type: 'answer',
      },
      sendSignal,
      'current-identity-id',
    );

    expect(sendSignal).toHaveBeenLastCalledWith(
      'peer-identity-id',
      'offer',
      expect.objectContaining({
        mediaEncryption: {
          acceptsEncrypted: true,
          enabled: true,
          version: 1,
        },
      }),
    );
    expect(
      sendSignal.mock.calls.filter(([, signalType]) => signalType === 'offer'),
    ).toHaveLength(2);
    expect(manager.isMediaEncryptionActiveWith('peer-identity-id')).toBe(true);
  });

  it('does not throw when encoded streams are rejected by the browser', () => {
    const cipher = new EncodedCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const sender = {
      createEncodedStreams: jest.fn(() => {
        throw new Error('Encoded insertable streams are disabled.');
      }),
    } as unknown as RTCRtpSender;

    expect(() => cipher.configureSender(sender, () => true)).not.toThrow();
  });

  it('serializes concurrent peer creation for the same identity', async () => {
    const peers: FakePeerConnection[] = [];
    const configurations: RTCConfiguration[] = [];

    installPeerConnectionMock(peers, configurations);
    const manager = callPeerConnectionManager();
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
    const manager = callPeerConnectionManager();

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
    const manager = callPeerConnectionManager();
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
    const manager = callPeerConnectionManager();
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

  it('classifies remote screen share by stream id metadata', () => {
    const manager = callPeerConnectionManager();
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

  it('tracks video-only remote streams', () => {
    const manager = callPeerConnectionManager();
    const internals = managerInternals(manager);
    const videoTrack = mediaTrack('remote-video-track', 'video');
    const videoStream = mediaStreamWithTracks([videoTrack], 'video-stream');

    internals.handleRemoteTrack(
      'peer-identity-id',
      remoteTrackEvent(videoTrack, [videoStream]),
    );

    expect(internals.remoteStreams.get('peer-identity-id')).toBe(videoStream);
  });

  it('removes stale peers and their media when they leave', async () => {
    const peers: FakePeerConnection[] = [];

    installPeerConnectionMock(peers);
    const manager = callPeerConnectionManager();
    const internals = managerInternals(manager);
    const screenTrack = mediaTrack('remote-screen-track', 'video');

    manager.configure(() => Promise.resolve({ iceServers: [] }));
    await manager.ensurePeer('peer-identity-id', false, () =>
      Promise.resolve(),
    );
    internals.remoteStreams.set(
      'peer-identity-id',
      mediaStreamWithTracks([mediaTrack('remote-audio-track', 'audio')]),
    );
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
    expect(internals.remoteStreams.has('peer-identity-id')).toBe(false);
    expect(internals.remoteScreenStreams.has('peer-identity-id')).toBe(false);
  });
});
